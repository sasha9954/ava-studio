from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.core.snapshot_media import media_refs_summary, preserve_media_refs, sanitize_snapshot_runtime_media
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.core.media_cleanup import cleanup_workspace_media, cleanup_workspace_stage_media
from app.schemas import SnapshotSaveRequest

router = APIRouter(prefix='/workspace', tags=['workspace'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator', 'audio_studio'}




def state_richness_v206b(data: dict) -> int:
    if not isinstance(data, dict):
        return 0
    root = data.get("project") if isinstance(data.get("project"), dict) else data
    score = 0
    for key in [
        "audio", "audio_file", "scenes", "phrases", "board_scenes", "videos", "images", "jobs", "assets", "final_video_url",
        "sourceVideos", "source_videos", "sourceVideo", "source_video", "sourceVideoPath", "sourceVideoPathForAssembly",
        "uploadedSourceVideoPath", "matchSegments", "videoBlocks", "timingContext", "audioMap", "audioPreviewMeta",
        "audioPathForAssembly", "assembleAudioPath", "importSignature",
    ]:
        value = root.get(key)
        if isinstance(value, list):
            score += min(len(value), 50) * 3
        elif isinstance(value, dict):
            score += 5 if value else 0
        elif value:
            score += 3
    score += min(len(str(data)), 20000) // 1000
    return score

def workspace_public(workspace: dict) -> dict:
    return {k: v for k, v in workspace.items() if k != 'user_id'}


def get_or_create_workspace(db: dict, user: dict) -> dict:
    workspace = next(
        (item for item in db['workspaces'].values() if item.get('user_id') == user['id'] and item.get('status') == 'active'),
        None,
    )
    if workspace:
        return workspace

    workspace_id = make_id('w')
    workspace = {
        'id': workspace_id,
        'user_id': user['id'],
        'name': 'Рабочая область',
        'status': 'active',
        'kind': 'current_workspace',
        'ttl_days': 3,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    db['workspaces'][workspace_id] = workspace
    db['workspace_snapshots'][workspace_id] = {}
    return workspace


def count_items(data: dict, keys: list[str]) -> int:
    if not isinstance(data, dict):
        return 0
    for key in keys:
        value = data.get(key)
        if isinstance(value, list):
            return len(value)
        if isinstance(value, dict):
            return len(value)
        if value:
            return 1
    return 0


def has_any(data: dict, keys: list[str]) -> bool:
    if not isinstance(data, dict):
        return False
    return any(bool(data.get(key)) for key in keys)



# AVA_VIDEO_NODE_NESTED_SUMMARY_V80: Video Match saves data as
# {schema:'ava_video_node_workspace_snapshot_v1', project:{matchSegments, videoBlocks,...}}.
# Project/workspace cards should count the nested project too.
def video_node_snapshot_project(data: dict) -> dict:
    if not isinstance(data, dict):
        return {}
    nested = data.get('project')
    if isinstance(nested, dict):
        return nested
    return data

def build_workspace_summary(snapshots: dict) -> dict:
    manual = (snapshots.get('manual_timing') or {}).get('data') or {}
    podcast = (snapshots.get('podcast') or {}).get('data') or {}
    board = (snapshots.get('board') or {}).get('data') or {}
    assembly = (snapshots.get('board_assembly') or {}).get('data') or {}
    video_node = (snapshots.get('video_node') or {}).get('data') or {}
    video_node_project = video_node_snapshot_project(video_node)
    generator = (snapshots.get('generator') or {}).get('data') or {}
    audio_studio = (snapshots.get('audio_studio') or {}).get('data') or {}

    return {
        'manual_timing': {
            'audio_loaded': has_any(manual, ['audio', 'audio_file', 'audio_url', 'audio_name']),
            'scenes_count': count_items(manual, ['scenes', 'segments']),
            'phrases_count': count_items(manual, ['phrases', 'asr_phrases', 'audio_phrases']),
        },
        'podcast': {
            'audio_loaded': has_any(podcast, ['assembled_audio', 'audio', 'audio_url']),
            'roles_count': count_items(podcast, ['roles', 'speakers']),
            'insertions_count': count_items(podcast, ['insertions', 'clips', 'items']),
        },
        'board': {
            'scenes_count': count_items(board, ['board_scenes', 'scenes']),
            'images_count': count_items(board, ['images', 'image_urls', 'generated_images']),
            'videos_count': count_items(board, ['videos', 'video_urls', 'generated_videos']),
        },
        'board_assembly': {
            'ready_videos_count': count_items(assembly, ['ready_videos', 'scene_videos', 'videos']),
            'final_video_ready': has_any(assembly, ['final_video_url', 'finalVideoUrl', 'output_url']),
        },
        'video_node': {
            'segments_count': count_items(video_node_project, ['matchSegments', 'segments']),
            'candidates_count': count_items(video_node_project, ['candidates', 'selected_candidates', 'matchSegments']),
            'final_video_ready': has_any(video_node_project, ['final_video_url', 'finalVideoUrl', 'output_url', 'assembledPreview']),
        },
        'generator': {
            'jobs_count': count_items(generator, ['jobs', 'generations']),
            'completed_count': count_items(generator, ['completed', 'completed_jobs', 'videos']),
        },
        'audio_studio': {
            'scenes_count': count_items(audio_studio, ['scenes']),
            'variants_count': sum(len((scene or {}).get('variants') or []) for scene in (audio_studio.get('scenes') or []) if isinstance(scene, dict)) if isinstance(audio_studio, dict) else 0,
            'applied_count': sum(1 for scene in (audio_studio.get('scenes') or []) if isinstance(scene, dict) and bool(scene.get('appliedVariantId') or scene.get('applied_variant_id'))),
        },
    }


@router.get('/current')
def current_workspace(user: dict = Depends(get_current_user)):
    def op(db):
        workspace = get_or_create_workspace(db, user)
        return {'workspace': workspace_public(workspace)}
    return store.update(op)


@router.get('/summary')
def workspace_summary(user: dict = Depends(get_current_user)):
    def op(db):
        workspace = get_or_create_workspace(db, user)
        snapshots = db['workspace_snapshots'].get(workspace['id'], {})
        return {
            'workspace': workspace_public(workspace),
            'summary': build_workspace_summary(snapshots),
            'updated_at': workspace.get('updated_at'),
        }
    return store.update(op)


@router.get('/snapshots/{stage}')
def get_workspace_snapshot(stage: str, user: dict = Depends(get_current_user)):
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')

    def op(db):
        workspace = get_or_create_workspace(db, user)
        snapshot = db['workspace_snapshots'].get(workspace['id'], {}).get(stage)
        return {'workspace': workspace_public(workspace), 'snapshot': snapshot or {'stage': stage, 'data': {}, 'updated_at': None}}
    return store.update(op)


@router.post('/snapshots/{stage}')
def save_workspace_snapshot(stage: str, payload: SnapshotSaveRequest, user: dict = Depends(get_current_user)):
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')

    def op(db):
        workspace = get_or_create_workspace(db, user)
        db['workspace_snapshots'].setdefault(workspace['id'], {})
        current = db['workspace_snapshots'][workspace['id']].get(stage)
        cleanup = None
        is_destructive_clear = (
            payload.guard_mode == 'replace'
            and not (payload.data or {})
            and str(payload.client_version or '').startswith('workflow-stage-controls-clear')
        )
        if is_destructive_clear:
            cleanup = cleanup_workspace_stage_media(db, workspace['id'], stage, user_id=user.get('id'))
        incoming_data, removed_runtime = sanitize_snapshot_runtime_media(payload.data or {})
        preserved_media_refs = 0
        if payload.guard_mode == 'safe_merge' and current:
            old_score = state_richness_v206b(current.get('data') or {})
            new_score = state_richness_v206b(incoming_data)
            if old_score > 10 and new_score < max(3, old_score // 4):
                return {
                    'saved': False,
                    'reason': 'incoming_workspace_snapshot_too_poor_to_overwrite_saved_state_v206b',
                    'old_score': old_score,
                    'new_score': new_score,
                    'snapshot': current,
                    '_skip_store_write_v206b': True,
                }
            incoming_data, preserved_media_refs = preserve_media_refs(current.get('data') or {}, incoming_data)
        print('[PROJECT SAVE MEDIA REFS SUMMARY]', {
            'scope': 'workspace',
            'workspace_id': workspace['id'],
            'stage': stage,
            **media_refs_summary(incoming_data),
            'removedRuntimeBlobCount': removed_runtime,
            'preservedAssetRefsCount': preserved_media_refs,
        })
        snapshot = {
            'stage': stage,
            'data': incoming_data,
            'client_version': payload.client_version,
            'updated_at': now_iso(),
        }
        db['workspace_snapshots'][workspace['id']][stage] = snapshot
        workspace['updated_at'] = now_iso()
        result = {'saved': True, 'workspace': workspace_public(workspace), 'snapshot': snapshot}
        if cleanup is not None:
            result['cleanup'] = cleanup
            result['hard_cleared'] = True
        return result
    return store.update(op)


@router.delete('/current')
def clear_workspace(user: dict = Depends(get_current_user)):
    def op(db):
        workspace = get_or_create_workspace(db, user)
        cleanup = cleanup_workspace_media(db, workspace['id'], user_id=user.get('id'))
        db['workspace_snapshots'][workspace['id']] = {}
        workspace['updated_at'] = now_iso()
        return {'cleared': True, 'hard_cleared': True, 'workspace': workspace_public(workspace), 'cleanup': cleanup}
    return store.update(op)
