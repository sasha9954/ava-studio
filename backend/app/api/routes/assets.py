import json
import mimetypes
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import make_id, now_iso
from app.core.storage import store

router = APIRouter(prefix='/assets', tags=['assets'])

MAX_AUDIO_BYTES = 500 * 1024 * 1024
MAX_MEDIA_BYTES = 800 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.webm', '.flac', '.mp4', '.mov', '.mkv', '.avi', '.m4v'}
ALLOWED_AUDIO_CONTENT_PREFIXES = ('audio/', 'video/')
ALLOWED_AUDIO_CONTENT_TYPES = {'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'application/octet-stream'}
VIDEO_TO_AUDIO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.avi', '.m4v'}
ALLOWED_ASSET_KINDS = {'audio', 'image', 'video', 'assembly', 'thumbnail'}
ASSET_KIND_EXTENSIONS = {
    'audio': {'.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.webm', '.flac'},
    'image': {'.png', '.jpg', '.jpeg', '.webp', '.gif'},
    'video': {'.mp4', '.mov', '.mkv', '.avi', '.m4v', '.webm'},
    'assembly': {'.mp4', '.mov', '.mkv', '.m4v', '.webm'},
    'thumbnail': {'.png', '.jpg', '.jpeg', '.webp'},
}
MEDIA_MIME_BY_EXTENSION = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
}


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


class RegisterStaticAssetIn(BaseModel):
    url: str | None = None
    path: str | None = None
    project_id: str | None = None
    projectId: str | None = None
    kind: str | None = 'video'
    stage: str | None = 'board'
    original_name: str | None = None
    originalName: str | None = None
    scene_id: str | None = None
    sceneId: str | None = None





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


def _guess_media_mime(path: Path, fallback: str = 'application/octet-stream') -> str:
    return MEDIA_MIME_BY_EXTENSION.get(path.suffix.lower()) or mimetypes.guess_type(str(path))[0] or fallback


def _safe_stage(stage: str | None) -> str:
    value = (stage or 'manual_timing').strip().lower()
    value = re.sub(r'[^a-z0-9_\-]+', '_', value)
    return value or 'manual_timing'


def _safe_asset_kind(kind: str | None) -> str:
    value = (kind or 'video').strip().lower()
    value = re.sub(r'[^a-z0-9_\-]+', '_', value)
    if value not in ALLOWED_ASSET_KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unsupported asset kind')
    return value


def _asset_storage_dir(user_id: str, project_id: str | None, stage: str | None) -> Path:
    settings = get_settings()
    scope_dir = Path('projects') / project_id if project_id else Path('workspace')
    return settings.storage_path / 'users' / user_id / scope_dir / 'assets' / _safe_stage(stage)


def _asset_file_path_from_record(asset: dict | None) -> Path | None:
    if not isinstance(asset, dict):
        return None
    raw = str(asset.get('storage_path') or asset.get('storagePath') or '').strip()
    if not raw:
        return None

    settings = get_settings()
    backend_dir = Path(__file__).resolve().parents[3]
    normalized = raw.replace('\\', '/')
    candidates = []
    for value in [raw, normalized]:
        path = Path(value)
        if path not in candidates:
            candidates.append(path)
        if not path.is_absolute():
            for prefix in [settings.storage_path.parent, backend_dir, Path.cwd()]:
                candidate = prefix / path
                if candidate not in candidates:
                    candidates.append(candidate)

    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate
        except Exception:
            continue
    return candidates[0] if candidates else None


def _resolve_static_asset_path(value: str | None) -> Path:
    raw = str(value or '').strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Missing static asset url')
    try:
        parsed = urlparse(raw)
        raw_path = parsed.path if parsed.scheme in {'http', 'https'} else raw
    except Exception:
        raw_path = raw

    raw_path = unquote(raw_path.split('?', 1)[0].split('#', 1)[0])
    marker = '/static/assets/'
    if marker in raw_path:
        rel = raw_path.split(marker, 1)[1]
    elif raw_path.startswith('static/assets/'):
        rel = raw_path[len('static/assets/'):]
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Only /static/assets media can be registered')

    static_root = get_settings().static_path.resolve()
    candidate = (static_root / 'assets' / Path(rel)).resolve()
    try:
        candidate.relative_to(static_root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid static asset path')
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Static asset file not found')
    return candidate


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


def _validate_media_upload(file: UploadFile, kind: str) -> str:
    original_name = _safe_filename(file.filename or kind)
    suffix = Path(original_name).suffix.lower()
    content_type = (file.content_type or '').lower()
    allowed_extensions = ASSET_KIND_EXTENSIONS.get(kind, set())
    allowed_content = content_type.startswith(f'{kind}/') or content_type == 'application/octet-stream'
    if suffix not in allowed_extensions and not allowed_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unsupported media file type')
    return suffix if suffix in allowed_extensions else '.bin'


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


def _probe_media_metadata(path: Path, kind: str) -> dict:
    metadata: dict = {}
    exe = shutil.which('ffprobe')
    if not exe or kind not in {'audio', 'video', 'assembly'}:
        return metadata
    try:
        result = subprocess.run(
            [
                exe,
                '-v', 'error',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                str(path),
            ],
            text=True,
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            return metadata
        data = json.loads(result.stdout or '{}')
        duration = float(data.get('format', {}).get('duration') or 0)
        if duration > 0:
            metadata['duration_sec'] = round(duration, 3)
        video_stream = next((item for item in data.get('streams', []) if item.get('codec_type') == 'video'), None)
        if video_stream:
            metadata['width'] = int(video_stream.get('width') or 0)
            metadata['height'] = int(video_stream.get('height') or 0)
    except Exception:
        return metadata
    return metadata


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
        'assetId': asset['id'],
        'asset_api_path': asset_api_path,
        'assetApiPath': asset_api_path,
        'asset_url': f"{settings.public_base_url}/api{asset_api_path}",
        'assetUrl': f"{settings.public_base_url}/api{asset_api_path}",
        'kind': asset.get('kind'),
        'project_id': asset.get('project_id'),
        'projectId': asset.get('project_id'),
        'stage': asset.get('stage'),
        'audio_name': asset.get('original_name'),
        'name': asset.get('original_name'),
        'original_name': asset.get('original_name'),
        'originalName': asset.get('original_name'),
        'audio_size_bytes': asset.get('size_bytes', 0),
        'size_bytes': asset.get('size_bytes', 0),
        'sizeBytes': asset.get('size_bytes', 0),
        'audio_duration_sec': asset.get('duration_sec', 0),
        'duration_sec': asset.get('duration_sec', 0),
        'durationSec': asset.get('duration_sec', 0),
        'width': asset.get('width', 0),
        'height': asset.get('height', 0),
        'mime_type': asset.get('mime_type'),
        'mimeType': asset.get('mime_type'),
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

    asset_dir = _asset_storage_dir(user['id'], project_id, safe_stage)
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


@router.post('/register-static')
def register_static_asset(payload: RegisterStaticAssetIn, user: dict = Depends(get_current_user)):
    project_id = payload.project_id or payload.projectId
    _validate_project_access(project_id, user['id'])

    kind = _safe_asset_kind(payload.kind)
    source_path = _resolve_static_asset_path(payload.url or payload.path)
    suffix = source_path.suffix.lower()
    if suffix not in ASSET_KIND_EXTENSIONS.get(kind, set()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Static asset extension does not match requested kind')

    asset_id = make_id('asset')
    safe_stage = _safe_stage(payload.stage or kind)
    asset_dir = _asset_storage_dir(user['id'], project_id, safe_stage)
    asset_dir.mkdir(parents=True, exist_ok=True)
    target_path = asset_dir / f'{asset_id}{suffix}'
    shutil.copy2(source_path, target_path)

    size_bytes = target_path.stat().st_size if target_path.exists() else 0
    if size_bytes <= 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Static asset is empty')

    original_name = _safe_filename(payload.original_name or payload.originalName or source_path.name)
    mime_type = _guess_media_mime(target_path)
    media_metadata = _probe_media_metadata(target_path, kind)
    asset = {
        'id': asset_id,
        'user_id': user['id'],
        'project_id': project_id,
        'stage': safe_stage,
        'kind': kind,
        'original_name': original_name,
        'mime_type': mime_type,
        'size_bytes': size_bytes,
        'storage_path': str(target_path),
        'created_at': now_iso(),
        'updated_at': now_iso(),
        'source_static_url': payload.url or payload.path or '',
        'source_static_path': str(source_path),
        'scene_id': payload.scene_id or payload.sceneId or '',
        **media_metadata,
    }

    def op(db):
        db.setdefault('assets', {})[asset_id] = asset
        public = _asset_public(asset)
        public.update({
            'ok': True,
            'source_static_url': asset.get('source_static_url'),
            'source_static_path': asset.get('source_static_path'),
            'scene_id': asset.get('scene_id'),
        })
        return public

    return store.update(op)


@router.post('/media')
async def upload_media_asset(
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    kind: str | None = Form(default='image'),
    stage: str | None = Form(default='board_images'),
    user: dict = Depends(get_current_user),
):
    _validate_project_access(project_id, user['id'])
    safe_kind = _safe_asset_kind(kind)
    suffix = _validate_media_upload(file, safe_kind)
    original_name = _safe_filename(file.filename or f'{safe_kind}{suffix}')
    asset_id = make_id('asset')
    safe_stage = _safe_stage(stage or safe_kind)

    asset_dir = _asset_storage_dir(user['id'], project_id, safe_stage)
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
                if size_bytes > MAX_MEDIA_BYTES:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail='Media file is too large')
                buffer.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    if size_bytes <= 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Uploaded media is empty')

    mime_type = file.content_type or _guess_media_mime(target_path)
    asset = {
        'id': asset_id,
        'user_id': user['id'],
        'project_id': project_id,
        'stage': safe_stage,
        'kind': safe_kind,
        'original_name': original_name,
        'mime_type': mime_type,
        'size_bytes': size_bytes,
        'storage_path': str(target_path),
        'created_at': now_iso(),
        'updated_at': now_iso(),
        **_probe_media_metadata(target_path, safe_kind),
    }

    def op(db):
        db.setdefault('assets', {})[asset_id] = asset
        public = _asset_public(asset)
        public.update({'ok': True})
        return public

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

    source_path = _asset_file_path_from_record(source_asset)
    if not source_path or not source_path.exists() or not source_path.is_file():
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




def _asset_thumb_cache_path(asset_id: str, source_path: Path) -> Path:
    return source_path.parent / f'{asset_id}_thumb.jpg'


def _create_asset_video_thumb(source_path: Path, thumb_path: Path) -> None:
    # AVA_ASSET_VIDEO_THUMB_ENDPOINT_V12B:
    # Create a small cached JPG for Generator history cards instead of streaming full MP4s.
    exe = shutil.which('ffmpeg')
    if not exe:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='ffmpeg_not_found')
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    attempts = [
        ['-y', '-ss', '0.35', '-i', str(source_path), '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '5', str(thumb_path)],
        ['-y', '-ss', '0', '-i', str(source_path), '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '5', str(thumb_path)],
    ]
    last_stderr = ''
    for args in attempts:
        result = subprocess.run([exe, *args], text=True, capture_output=True, timeout=45)
        if result.returncode == 0 and thumb_path.exists() and thumb_path.stat().st_size > 0:
            return
        last_stderr = result.stderr or last_stderr
    thumb_path.unlink(missing_ok=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={'code': 'thumb_failed', 'stderr': (last_stderr or '')[-1800:]},
    )


@router.get('/{asset_id}/thumb')
def read_asset_thumb(asset_id: str, user: dict = Depends(get_current_user)):
    db = store.get_db()
    asset = db.get('assets', {}).get(asset_id)
    if not asset or asset.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    path = _asset_file_path_from_record(asset)
    if not path or not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset file missing')
    kind = str(asset.get('kind') or '').lower()
    mime = str(asset.get('mime_type') or '').lower()
    if kind == 'image' or mime.startswith('image/'):
        return FileResponse(str(path), media_type=asset.get('mime_type') or _guess_media_mime(path) or 'image/jpeg')
    if kind not in {'video', 'assembly'} and not mime.startswith('video/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Asset thumbnail is supported for image/video only')
    thumb_path = _asset_thumb_cache_path(asset_id, path)
    if (not thumb_path.exists()) or thumb_path.stat().st_size <= 0 or thumb_path.stat().st_mtime < path.stat().st_mtime:
        _create_asset_video_thumb(path, thumb_path)
    return FileResponse(str(thumb_path), media_type='image/jpeg', filename=f'{asset_id}_thumb.jpg')

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
    path = _asset_file_path_from_record(asset)
    if not path or not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset file missing')
    return FileResponse(
        str(path),
        media_type=asset.get('mime_type') or 'application/octet-stream',
        filename=asset.get('original_name') or path.name,
    )
