import re
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import make_id, now_iso
from app.core.storage import store

router = APIRouter(prefix='/assets', tags=['assets'])

MAX_AUDIO_BYTES = 500 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.webm', '.flac', '.mp4', '.mov', '.mkv', '.avi', '.m4v'}
ALLOWED_AUDIO_CONTENT_PREFIXES = ('audio/', 'video/')
ALLOWED_AUDIO_CONTENT_TYPES = {'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'application/octet-stream'}
VIDEO_TO_AUDIO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.avi', '.m4v'}


class CutAudioRangeIn(BaseModel):
    asset_id: str | None = None
    assetId: str | None = None
    asset_api_path: str | None = None
    assetApiPath: str | None = None
    audio_url: str | None = None
    audioUrl: str | None = None
    project_id: str | None = None
    projectId: str | None = None
    stage: str | None = 'manual_timing'
    start_sec: float | None = None
    startSec: float | None = None
    end_sec: float | None = None
    endSec: float | None = None
    duration_sec: float | None = None
    durationSec: float | None = None
    label: str | None = None





def _run_asset_ffmpeg(args: list[str]) -> None:
    exe = shutil.which('ffmpeg')
    if not exe:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='ffmpeg_not_found',
        )
    result = subprocess.run([exe, *args], text=True, capture_output=True)
    if result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'code': 'ffmpeg_failed',
                'stderr': (result.stderr or '')[-2500:],
            },
        )


def _looks_like_video_upload(filename: str, content_type: str, suffix: str) -> bool:
    lowered_type = (content_type or '').lower()
    lowered_name = (filename or '').lower()
    lowered_suffix = (suffix or Path(lowered_name).suffix or '').lower()
    return (
        lowered_type.startswith('video/')
        or lowered_suffix in VIDEO_TO_AUDIO_EXTENSIONS
        or any(lowered_name.endswith(ext) for ext in VIDEO_TO_AUDIO_EXTENSIONS)
    )


def _convert_upload_to_mp3(source_path: Path, target_path: Path) -> None:
    _run_asset_ffmpeg([
        '-y',
        '-i', str(source_path),
        '-vn',
        '-map', '0:a:0',
        '-acodec', 'libmp3lame',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '192k',
        str(target_path),
    ])


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



def _ffprobe_duration(path: Path) -> float:
    exe = shutil.which('ffprobe')
    if not exe:
        return 0.0
    try:
        result = subprocess.run(
            [
                exe,
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                str(path),
            ],
            text=True,
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0:
            value = float((result.stdout or '').strip() or 0)
            return round(max(0.0, value), 3)
    except Exception:
        return 0.0
    return 0.0


def _probe_audio_duration_any(path: Path) -> float:
    return _probe_audio_duration(path) or _ffprobe_duration(path)


def _asset_id_from_audio_ref(value: str | None) -> str:
    raw = str(value or '').strip()
    if not raw:
        return ''
    if raw.startswith('asset_'):
        return raw
    match = re.search(r'/assets/([^/]+)/file', raw)
    if match:
        return match.group(1)
    return ''


def _run_audio_ffmpeg(args: list[str]) -> None:
    exe = shutil.which('ffmpeg')
    if not exe:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='ffmpeg_not_found')
    result = subprocess.run([exe, *args], text=True, capture_output=True)
    if result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'code': 'ffmpeg_failed', 'stderr': (result.stderr or '')[-2500:]},
        )




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
        'converted_from_video': bool(asset.get('converted_from_video')),
        'source_upload_mime_type': asset.get('source_upload_mime_type'),
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

    stored_mime_type = file.content_type or 'application/octet-stream'
    converted_from_video = False
    source_upload_mime_type = stored_mime_type

    if _looks_like_video_upload(original_name, stored_mime_type, suffix):
        converted_path = asset_dir / f'{asset_id}.mp3'
        try:
            _convert_upload_to_mp3(target_path, converted_path)
        except Exception:
            converted_path.unlink(missing_ok=True)
            raise

        if not converted_path.exists() or converted_path.stat().st_size <= 0:
            converted_path.unlink(missing_ok=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Video audio extraction produced empty file')

        target_path.unlink(missing_ok=True)
        target_path = converted_path
        size_bytes = converted_path.stat().st_size
        stored_mime_type = 'audio/mpeg'
        original_name = f"{Path(original_name).stem}_audio.mp3"
        converted_from_video = True

    duration_sec = _probe_audio_duration_any(target_path)
    asset = {
        'id': asset_id,
        'user_id': user['id'],
        'project_id': project_id,
        'stage': safe_stage,
        'kind': 'audio',
        'original_name': original_name,
        'mime_type': stored_mime_type,
        'size_bytes': size_bytes,
        'duration_sec': duration_sec,
        'storage_path': str(target_path),
        'created_at': now_iso(),
        'updated_at': now_iso(),
        'converted_from_video': converted_from_video,
        'source_upload_mime_type': source_upload_mime_type,
    }

    def op(db):
        db.setdefault('assets', {})[asset_id] = asset
        return _asset_public(asset)

    return store.update(op)


@router.post('/audio/cut-range')
def cut_audio_range(payload: CutAudioRangeIn, user: dict = Depends(get_current_user)):
    raw_asset_id = (
        payload.asset_id
        or payload.assetId
        or _asset_id_from_audio_ref(payload.asset_api_path)
        or _asset_id_from_audio_ref(payload.assetApiPath)
        or _asset_id_from_audio_ref(payload.audio_url)
        or _asset_id_from_audio_ref(payload.audioUrl)
    )
    asset_id = str(raw_asset_id or '').strip()
    if not asset_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Missing audio asset_id')

    db = store.get_db()
    source_asset = db.get('assets', {}).get(asset_id)
    if not source_asset or source_asset.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Source audio asset not found')

    project_id = payload.project_id or payload.projectId or source_asset.get('project_id')
    _validate_project_access(project_id, user['id'])

    source_path = Path(source_asset.get('storage_path') or '')
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Source audio file missing')

    try:
        start = max(0.0, float(payload.start_sec if payload.start_sec is not None else payload.startSec or 0))
        end = max(start, float(payload.end_sec if payload.end_sec is not None else payload.endSec or start))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid cut range')

    duration = float(payload.duration_sec if payload.duration_sec is not None else payload.durationSec or 0) or _probe_audio_duration_any(source_path)
    if duration <= 0:
        duration = _probe_audio_duration_any(source_path)
    if duration <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Cannot determine source audio duration')

    end = min(duration, end)
    cut_len = end - start
    if cut_len <= 0.03:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Cut range is too small')
    if duration - cut_len < 0.08:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Cannot delete the whole audio')

    new_duration = max(0.0, duration - cut_len)

    settings = get_settings()
    safe_stage = _safe_stage(payload.stage or source_asset.get('stage') or 'manual_timing')
    scope_dir = Path('projects') / project_id if project_id else Path('workspace')
    asset_dir = settings.storage_path / 'users' / user['id'] / scope_dir / 'assets' / safe_stage
    asset_dir.mkdir(parents=True, exist_ok=True)

    new_asset_id = make_id('asset')
    out_path = asset_dir / f'{new_asset_id}.mp3'
    original_name = _safe_filename(source_asset.get('original_name') or 'audio')
    out_name = f"{Path(original_name).stem}_cut_{start:.3f}_{end:.3f}.mp3".replace(' ', '_')

    if start <= 0.02:
        _run_audio_ffmpeg([
            '-y',
            '-ss', f'{end:.3f}',
            '-i', str(source_path),
            '-vn',
            '-acodec', 'libmp3lame',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            str(out_path),
        ])
    elif end >= duration - 0.02:
        _run_audio_ffmpeg([
            '-y',
            '-i', str(source_path),
            '-t', f'{start:.3f}',
            '-vn',
            '-acodec', 'libmp3lame',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            str(out_path),
        ])
    else:
        filter_graph = (
            f'[0:a]atrim=0:{start:.6f},asetpts=PTS-STARTPTS[a0];'
            f'[0:a]atrim={end:.6f}:{duration:.6f},asetpts=PTS-STARTPTS[a1];'
            '[a0][a1]concat=n=2:v=0:a=1[out]'
        )
        _run_audio_ffmpeg([
            '-y',
            '-i', str(source_path),
            '-filter_complex', filter_graph,
            '-map', '[out]',
            '-vn',
            '-acodec', 'libmp3lame',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            str(out_path),
        ])

    size_bytes = out_path.stat().st_size if out_path.exists() else 0
    if size_bytes <= 0:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Cut output is empty')

    probed_duration = _probe_audio_duration_any(out_path) or round(new_duration, 3)

    new_asset = {
        'id': new_asset_id,
        'user_id': user['id'],
        'project_id': project_id,
        'stage': safe_stage,
        'kind': 'audio',
        'original_name': out_name,
        'mime_type': 'audio/mpeg',
        'size_bytes': size_bytes,
        'duration_sec': round(float(probed_duration), 3),
        'storage_path': str(out_path),
        'created_at': now_iso(),
        'updated_at': now_iso(),
        'source_asset_id': asset_id,
        'cut_range': {
            'start_sec': round(start, 3),
            'end_sec': round(end, 3),
            'duration_sec': round(cut_len, 3),
        },
    }

    def op(db):
        db.setdefault('assets', {})[new_asset_id] = new_asset
        public = _asset_public(new_asset)
        public.update({
            'ok': True,
            'source_asset_id': asset_id,
            'cut_start_sec': round(start, 3),
            'cut_end_sec': round(end, 3),
            'cut_duration_sec': round(cut_len, 3),
            'old_duration_sec': round(duration, 3),
            'new_duration_sec': round(float(probed_duration), 3),
            'stage': safe_stage,
        })
        return public

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
