from __future__ import annotations

import os
import re
import shutil
import urllib.parse
from pathlib import Path
from typing import Any

from app.core.config import get_settings


# AVA_DESTRUCTIVE_PROJECT_CLEANUP_V82
# Policy: project delete and stage clear are destructive. Snapshots AND project-owned
# media files are removed. Only files inside AVA backend storage/static roots are
# physically deleted. External user originals outside AVA roots are never unlinked.

BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_DIR = Path(__file__).resolve().parents[1]

ASSET_ID_RE = re.compile(r'(asset_[A-Za-z0-9_\-]+)')
API_ASSET_RE = re.compile(r'/api/assets/([^/]+)/file|/assets/([^/]+)/file')

STAGE_ALIASES = {
    'manual_timing': {'manual_timing', 'timing', 'asr'},
    'podcast': {'podcast', 'podcast_audio', 'podcast_audio_composer'},
    'board': {'board', 'board_images', 'board_videos', 'board_audio', 'ltx_board', 'mmaudio'},
    'board_assembly': {'board_assembly', 'assembly', 'montage'},
    'video_node': {'video_node', 'video_match', 'video_match_board', 'video_match_sources', 'video_match_outputs', 'video_match_audio', 'video_match_overrides'},
    'generator': {'generator', 'standalone_generator'},
}


def _settings_roots() -> list[Path]:
    settings = get_settings()
    candidates = [
        Path(settings.storage_path),
        BACKEND_DIR / Path(settings.storage_path),
        Path(settings.static_path),
        BACKEND_DIR / Path(settings.static_path),
        APP_DIR / 'static',
        BACKEND_DIR / 'static',
        APP_DIR / 'static' / 'assets',
        BACKEND_DIR / 'static' / 'assets',
    ]
    roots: list[Path] = []
    for item in candidates:
        try:
            resolved = item.resolve()
        except Exception:
            resolved = item.absolute()
        if resolved not in roots:
            roots.append(resolved)
    return roots


def _resolve_under_allowed_roots(value: str | None) -> Path | None:
    raw = str(value or '').strip()
    if not raw or raw.startswith(('blob:', 'data:')):
        return None

    try:
        parsed = urllib.parse.urlparse(raw)
        parsed_path = urllib.parse.unquote(parsed.path if parsed.scheme in {'http', 'https'} else raw)
    except Exception:
        parsed_path = raw

    parsed_path = parsed_path.split('?', 1)[0].split('#', 1)[0]
    roots = _settings_roots()

    # URL paths from app routes.
    route_prefixes = {
        '/api/video-match/source/': APP_DIR / 'static' / 'assets' / 'video_match_sources',
        '/api/video-match/audio/': APP_DIR / 'static' / 'assets' / 'video_match_audio',
        '/api/video-match/override/': APP_DIR / 'static' / 'assets' / 'video_match_overrides',
        '/api/video-match/output/': APP_DIR / 'static' / 'assets' / 'video_match_outputs',
    }
    for prefix, base in route_prefixes.items():
        if parsed_path.startswith(prefix):
            return (base / Path(parsed_path).name).resolve()

    if parsed_path.startswith('/static/'):
        rel = parsed_path[len('/static/'):].lstrip('/\\')
        return (APP_DIR / 'static' / rel).resolve()

    # /api/assets/asset_id/file is resolved through db asset record, not here.
    if API_ASSET_RE.search(parsed_path):
        return None

    # Windows path from JSON on Windows host; Path handles it correctly on Windows.
    raw_path = Path(raw)
    candidates: list[Path] = []
    if raw_path.is_absolute():
        candidates.append(raw_path)
    else:
        candidates.extend([BACKEND_DIR / raw_path, APP_DIR / raw_path, Path.cwd() / raw_path])

    # Also try normalized slash form.
    normalized = raw.replace('\\', '/')
    norm_path = Path(normalized)
    if norm_path.is_absolute():
        candidates.append(norm_path)
    else:
        candidates.extend([BACKEND_DIR / norm_path, APP_DIR / norm_path, Path.cwd() / norm_path])

    for candidate in candidates:
        try:
            resolved = candidate.resolve()
            for root in roots:
                try:
                    resolved.relative_to(root)
                    return resolved
                except ValueError:
                    continue
        except Exception:
            continue
    return None


def _stage_matches(asset_stage: str | None, stage: str | None) -> bool:
    if not stage:
        return True
    clean_asset_stage = str(asset_stage or '').strip().lower()
    clean_stage = str(stage or '').strip().lower()
    aliases = STAGE_ALIASES.get(clean_stage, {clean_stage})
    if clean_asset_stage in aliases:
        return True
    return any(clean_asset_stage.startswith(alias + '_') for alias in aliases)


def _walk_collect_refs(value: Any, asset_ids: set[str], paths: set[Path], depth: int = 0) -> None:
    if value is None or depth > 12:
        return
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return
        for match in ASSET_ID_RE.findall(raw):
            asset_ids.add(match)
        for match in API_ASSET_RE.findall(raw):
            asset_id = match[0] or match[1]
            if asset_id:
                asset_ids.add(asset_id)
        path = _resolve_under_allowed_roots(raw)
        if path is not None:
            paths.add(path)
        return
    if isinstance(value, dict):
        # Explicit asset id keys are common in snapshots.
        for key in ('asset_id', 'assetId', 'audio_asset_id', 'audioAssetId', 'video_asset_id', 'videoAssetId', 'image_asset_id', 'imageAssetId'):
            item = value.get(key)
            if isinstance(item, str) and item.strip().startswith('asset_'):
                asset_ids.add(item.strip())
        # Explicit path/url keys may point to static media.
        for key in (
            'storage_path', 'storagePath', 'path', 'backendPath', 'backend_path',
            'sourceVideoPathForAssembly', 'source_video_path_for_assembly',
            'audioPathForAssembly', 'output_path', 'localPath', 'url', 'api_path', 'apiPath',
            'asset_api_path', 'assetApiPath', 'sourceVideoUrl', 'source_video_url',
            'overrideVideoUrl', 'overrideVideoPath', 'audioUrl', 'audio_url',
        ):
            item = value.get(key)
            if isinstance(item, str):
                path = _resolve_under_allowed_roots(item)
                if path is not None:
                    paths.add(path)
                for match in ASSET_ID_RE.findall(item):
                    asset_ids.add(match)
        for item in value.values():
            _walk_collect_refs(item, asset_ids, paths, depth + 1)
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            _walk_collect_refs(item, asset_ids, paths, depth + 1)


def _asset_path(asset: dict | None) -> Path | None:
    if not isinstance(asset, dict):
        return None
    raw = str(asset.get('storage_path') or asset.get('storagePath') or '').strip()
    return _resolve_under_allowed_roots(raw)


# AVA_MASTER_AUDIO_CLEANUP_GUARD_V209L
# Full mixed song audio is a project-level dependency for Board lip-sync autoslice.
# Do not remove it during stage cleanup just because a UI workflow was cleared.
# Vocal-only ASR stems are not enough for lip-sync; the mixed/master audio must survive.
def _asset_is_master_audio_protected_v209l(asset: dict | None) -> bool:
    if not isinstance(asset, dict):
        return False

    stage = str(
        asset.get('stage')
        or asset.get('asset_stage')
        or asset.get('assetStage')
        or ''
    ).strip().lower()

    kind = str(
        asset.get('kind')
        or asset.get('media_kind')
        or asset.get('mediaKind')
        or asset.get('type')
        or asset.get('mime_type')
        or asset.get('mimeType')
        or ''
    ).strip().lower()

    name_blob = " ".join(str(asset.get(key) or '') for key in (
        'name', 'filename', 'fileName', 'original_name', 'originalName',
        'audio_name', 'audioName', 'storage_path', 'storagePath',
        'asset_api_path', 'assetApiPath',
    )).strip().lower()

    stage_is_audio_owner = (
        stage in {
            'manual_timing',
            'manual_timing_audio',
            'manual_timing_master',
            'project_audio',
            'project_master_audio',
            'master_audio',
            'timing_audio',
            'source_audio',
        }
        or stage.startswith('manual_timing')
        or stage.startswith('project_audio')
        or stage.startswith('project_master_audio')
        or stage.startswith('master_audio')
    )

    looks_audio = (
        'audio' in kind
        or 'mp3' in kind
        or 'wav' in kind
        or name_blob.endswith(('.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'))
        or '.mp3' in name_blob
        or '.wav' in name_blob
        or '.m4a' in name_blob
    )

    if stage_is_audio_owner and looks_audio:
        return True

    return False


def _safe_unlink(path: Path, stats: dict) -> None:
    roots = _settings_roots()
    try:
        resolved = path.resolve()
    except Exception:
        stats['skipped_paths'].append(str(path))
        return

    allowed = False
    matched_root: Path | None = None
    for root in roots:
        try:
            resolved.relative_to(root)
            allowed = True
            matched_root = root
            break
        except ValueError:
            continue
    if not allowed:
        stats['skipped_paths'].append(str(resolved))
        return

    if not resolved.exists() or not resolved.is_file():
        stats['missing_files'] += 1
        return

    try:
        size = resolved.stat().st_size
        resolved.unlink()
        stats['deleted_files'] += 1
        stats['freed_bytes'] += size
        stats['deleted_paths'].append(str(resolved))
    except Exception as exc:
        stats['errors'].append({'path': str(resolved), 'error': str(exc)})
        return

    # Clean empty parent dirs up to the safe root.
    if matched_root:
        parent = resolved.parent
        while parent != matched_root and parent.exists():
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent


def _empty_stats(reason: str) -> dict:
    return {
        'reason': reason,
        'deleted_files': 0,
        'freed_bytes': 0,
        'freed_mb': 0.0,
        'asset_records_deleted': 0,
        'jobs_deleted': 0,
        'snapshots_deleted': 0,
        'workspace_snapshots_cleared': 0,
        'missing_files': 0,
        'deleted_paths': [],
        'skipped_paths': [],
        'errors': [],
    }


def _finalize(stats: dict) -> dict:
    stats['freed_mb'] = round(float(stats.get('freed_bytes') or 0) / (1024 * 1024), 3)
    return stats


def _delete_asset_records(db: dict, asset_ids: set[str], paths: set[Path], stats: dict) -> None:
    assets = db.setdefault('assets', {})
    for asset_id in sorted(list(asset_ids)):
        asset = assets.get(asset_id)
        if not asset:
            continue

        if _asset_is_master_audio_protected_v209l(asset):
            stats.setdefault('protected_master_audio_assets_v209l', []).append(asset_id)
            continue

        asset = assets.pop(asset_id, None)
        if not asset:
            continue
        path = _asset_path(asset)
        if path is not None:
            paths.add(path)
            # generated thumbs live next to asset files
            paths.add(path.parent / f'{asset_id}_thumb.jpg')
        stats['asset_records_deleted'] += 1


def _delete_paths(paths: set[Path], stats: dict) -> None:
    for path in sorted(paths, key=lambda item: str(item)):
        _safe_unlink(path, stats)


def _collect_assets_for_project(db: dict, project_id: str, stage: str | None = None) -> set[str]:
    result: set[str] = set()
    for asset_id, asset in (db.get('assets') or {}).items():
        if asset.get('project_id') != project_id:
            continue
        if stage and not _stage_matches(asset.get('stage'), stage):
            continue
        result.add(asset_id)
    return result


def _collect_assets_for_workspace(db: dict, user_id: str | None = None, stage: str | None = None) -> set[str]:
    result: set[str] = set()
    for asset_id, asset in (db.get('assets') or {}).items():
        if asset.get('project_id'):
            continue
        if user_id and asset.get('user_id') != user_id:
            continue
        if stage and not _stage_matches(asset.get('stage'), stage):
            continue
        result.add(asset_id)
    return result


def _data_mentions_project(value: Any, project_id: str) -> bool:
    if not project_id:
        return False
    try:
        text = str(value)
    except Exception:
        return False
    return project_id in text


def cleanup_project_stage_media(db: dict, project_id: str, stage: str, user_id: str | None = None) -> dict:
    stats = _empty_stats(f'project_stage_clear:{project_id}:{stage}')
    asset_ids: set[str] = set()
    paths: set[Path] = set()

    snapshot = ((db.get('snapshots') or {}).get(project_id) or {}).get(stage)
    if snapshot:
        _walk_collect_refs(snapshot.get('data') or {}, asset_ids, paths)
        stats['snapshots_deleted'] += 1
    asset_ids.update(_collect_assets_for_project(db, project_id, stage=stage))
    _delete_asset_records(db, asset_ids, paths, stats)
    _delete_paths(paths, stats)
    return _finalize(stats)


def cleanup_project_media(db: dict, project_id: str, user_id: str | None = None) -> dict:
    stats = _empty_stats(f'project_delete:{project_id}')
    asset_ids: set[str] = set()
    paths: set[Path] = set()

    project_snapshots = (db.get('snapshots') or {}).get(project_id) or {}
    _walk_collect_refs(project_snapshots, asset_ids, paths)
    stats['snapshots_deleted'] += len(project_snapshots)

    # Project assets, even if not present in snapshots.
    asset_ids.update(_collect_assets_for_project(db, project_id))

    # Project jobs can contain output urls/paths not present in snapshots.
    jobs = db.setdefault('jobs', {})
    for job_id, job in list(jobs.items()):
        if str(job.get('project_id') or job.get('projectId') or '') == project_id or _data_mentions_project(job, project_id):
            _walk_collect_refs(job, asset_ids, paths)
            jobs.pop(job_id, None)
            stats['jobs_deleted'] += 1

    # Project-scoped workspace snapshots are cleared too; v80 saves Video Match in both places.
    for workspace_id, snapshots in list((db.get('workspace_snapshots') or {}).items()):
        if not isinstance(snapshots, dict):
            continue
        for stage_name, snapshot in list(snapshots.items()):
            data = (snapshot or {}).get('data') if isinstance(snapshot, dict) else snapshot
            if _data_mentions_project(data, project_id):
                _walk_collect_refs(data, asset_ids, paths)
                snapshots[stage_name] = {'stage': stage_name, 'data': {}, 'updated_at': None, 'client_version': 'destructive-project-delete-v82'}
                stats['workspace_snapshots_cleared'] += 1

    # Project folder in storage is safe to remove wholesale after asset collection.
    if user_id:
        settings = get_settings()
        candidates = [
            Path(settings.storage_path) / 'users' / user_id / 'projects' / project_id,
            BACKEND_DIR / Path(settings.storage_path) / 'users' / user_id / 'projects' / project_id,
        ]
        for candidate in candidates:
            try:
                resolved = candidate.resolve()
                roots = _settings_roots()
                if any(str(resolved).startswith(str(root)) for root in roots) and resolved.exists() and resolved.is_dir():
                    before = 0
                    for child in resolved.rglob('*'):
                        if child.is_file():
                            try:
                                before += child.stat().st_size
                            except Exception:
                                pass
                    shutil.rmtree(resolved, ignore_errors=True)
                    if before:
                        stats['freed_bytes'] += before
                    break
            except Exception as exc:
                stats['errors'].append({'path': str(candidate), 'error': str(exc)})

    _delete_asset_records(db, asset_ids, paths, stats)
    _delete_paths(paths, stats)

    db.setdefault('snapshots', {}).pop(project_id, None)
    db.setdefault('projects', {}).pop(project_id, None)
    return _finalize(stats)


def cleanup_workspace_stage_media(db: dict, workspace_id: str, stage: str, user_id: str | None = None) -> dict:
    stats = _empty_stats(f'workspace_stage_clear:{workspace_id}:{stage}')
    asset_ids: set[str] = set()
    paths: set[Path] = set()
    snapshot = ((db.get('workspace_snapshots') or {}).get(workspace_id) or {}).get(stage)
    if snapshot:
        _walk_collect_refs(snapshot.get('data') or {}, asset_ids, paths)
        stats['snapshots_deleted'] += 1
    asset_ids.update(_collect_assets_for_workspace(db, user_id=user_id, stage=stage))
    _delete_asset_records(db, asset_ids, paths, stats)
    _delete_paths(paths, stats)
    return _finalize(stats)


def cleanup_workspace_media(db: dict, workspace_id: str, user_id: str | None = None) -> dict:
    stats = _empty_stats(f'workspace_clear:{workspace_id}')
    asset_ids: set[str] = set()
    paths: set[Path] = set()
    snapshots = (db.get('workspace_snapshots') or {}).get(workspace_id) or {}
    _walk_collect_refs(snapshots, asset_ids, paths)
    stats['snapshots_deleted'] += len(snapshots)
    asset_ids.update(_collect_assets_for_workspace(db, user_id=user_id))
    _delete_asset_records(db, asset_ids, paths, stats)
    _delete_paths(paths, stats)
    db.setdefault('workspace_snapshots', {})[workspace_id] = {}
    return _finalize(stats)
