import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import make_id, now_iso
from app.core.storage import store

router = APIRouter(prefix='/assets', tags=['assets'])

MAX_AUDIO_BYTES = 500 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.webm', '.flac', '.mp4'}
ALLOWED_AUDIO_CONTENT_PREFIXES = ('audio/',)
ALLOWED_AUDIO_CONTENT_TYPES = {'video/mp4', 'application/octet-stream'}


def _safe_filename(name: str) -> str:
    base = Path(name or 'audio').name
    base = re.sub(r'[^\w.()\- ]+', '_', base, flags=re.UNICODE).strip(' .')
    return base or 'audio'


def _safe_stage(stage: str | None) -> str:
    value = (stage or 'manual_timing').strip().lower()
    value = re.sub(r'[^a-z0-9_\-]+', '_', value)
    return value or 'manual_timing'


def _validate_project_access(project_id: str | None, user_id: str) -> None:
    if not project_id:
        return
    db = store.get_db()
    project = db['projects'].get(project_id)
    if not project or project.get('user_id') != user_id or project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')


def _validate_audio_upload(file: UploadFile) -> str:
    original_name = _safe_filename(file.filename or 'audio')
    suffix = Path(original_name).suffix.lower()
    content_type = (file.content_type or '').lower()
    allowed_content = content_type.startswith(ALLOWED_AUDIO_CONTENT_PREFIXES) or content_type in ALLOWED_AUDIO_CONTENT_TYPES
    if suffix not in ALLOWED_AUDIO_EXTENSIONS and not allowed_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Unsupported audio file type',
        )
    return suffix if suffix in ALLOWED_AUDIO_EXTENSIONS else '.bin'


def _probe_audio_duration(path: Path) -> float:
    try:
        from mutagen import File as MutagenFile

        media = MutagenFile(str(path))
        length = getattr(getattr(media, 'info', None), 'length', None)
        if length and length > 0:
            return round(float(length), 3)
    except Exception:
        pass
    return 0.0


def _asset_public(asset: dict) -> dict:
    settings = get_settings()
    asset_api_path = f"/assets/{asset['id']}/file"
    return {
        'asset_id': asset['id'],
        'asset_api_path': asset_api_path,
        'asset_url': f"{settings.public_base_url}/api{asset_api_path}",
        'kind': asset.get('kind'),
        'project_id': asset.get('project_id'),
        'stage': asset.get('stage'),
        'audio_name': asset.get('original_name'),
        'audio_size_bytes': asset.get('size_bytes', 0),
        'audio_duration_sec': asset.get('duration_sec', 0),
        'mime_type': asset.get('mime_type'),
        'created_at': asset.get('created_at'),
    }


@router.post('/audio')
async def upload_audio_asset(
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    stage: str | None = Form(default='manual_timing'),
    user: dict = Depends(get_current_user),
):
    _validate_project_access(project_id, user['id'])
    suffix = _validate_audio_upload(file)
    original_name = _safe_filename(file.filename or f'audio{suffix}')
    asset_id = make_id('asset')
    safe_stage = _safe_stage(stage)

    settings = get_settings()
    scope_dir = Path('projects') / project_id if project_id else Path('workspace')
    asset_dir = settings.storage_path / 'users' / user['id'] / scope_dir / 'assets' / safe_stage
    asset_dir.mkdir(parents=True, exist_ok=True)
    target_path = asset_dir / f'{asset_id}{suffix}'

    size_bytes = 0
    try:
        with target_path.open('wb') as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > MAX_AUDIO_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail='Audio file is too large',
                    )
                buffer.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    if size_bytes <= 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Uploaded audio is empty')

    duration_sec = _probe_audio_duration(target_path)
    asset = {
        'id': asset_id,
        'user_id': user['id'],
        'project_id': project_id,
        'stage': safe_stage,
        'kind': 'audio',
        'original_name': original_name,
        'mime_type': file.content_type or 'application/octet-stream',
        'size_bytes': size_bytes,
        'duration_sec': duration_sec,
        'storage_path': str(target_path),
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }

    def op(db):
        db.setdefault('assets', {})[asset_id] = asset
        return _asset_public(asset)

    return store.update(op)


@router.get('/{asset_id}')
def read_asset_meta(asset_id: str, user: dict = Depends(get_current_user)):
    db = store.get_db()
    asset = db.get('assets', {}).get(asset_id)
    if not asset or asset.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    return {'asset': _asset_public(asset)}


@router.get('/{asset_id}/file')
def read_asset_file(asset_id: str, user: dict = Depends(get_current_user)):
    db = store.get_db()
    asset = db.get('assets', {}).get(asset_id)
    if not asset or asset.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    path = Path(asset.get('storage_path') or '')
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset file missing')
    return FileResponse(
        str(path),
        media_type=asset.get('mime_type') or 'application/octet-stream',
        filename=asset.get('original_name') or path.name,
    )
