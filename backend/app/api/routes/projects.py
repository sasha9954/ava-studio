# AVA_PROJECT_BOARD_PRESERVE_SKIP_CHANGED_IMAGE_V131R: do not preserve old server-batch video refs after scene image replacement.\n# AVA_PROJECT_BOARD_PRESERVE_SERVER_BATCH_VIDEO_REFS_V131Q2: backend protects server-batch video refs from stale board saves.
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.snapshot_media import media_refs_summary, preserve_media_refs, sanitize_snapshot_runtime_media
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.core.media_cleanup import cleanup_project_media, cleanup_project_stage_media
from app.schemas import ProjectCreateRequest, ProjectUpdateRequest, SnapshotSaveRequest
import copy

router = APIRouter(prefix='/projects', tags=['projects'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator'}
PROJECT_THEME_COUNT = 8


# AVA_PROJECT_MODES_PACK_V1
DEFAULT_PROJECT_MODE = {
    'id': 'manual_general_v1',
    'label_ru': 'Обычный проект',
    'version': 1,
    'contract_ref': 'manual_general_v1',
}

PROJECT_MODE_LABELS = {
    'manual_general_v1': ('Обычный проект', 'manual_general_v1'),
    'lyric_meaning_remix_v1': ('Клип: подмена смысла', 'lyric_meaning_remix_v1'),
    'recipe_process_v1': ('Готовка / рецепт', 'recipe_process_readability_v1'),
    'video_first_documentary_v1': ('Документалка из видео', 'video_first_documentary_v1'),
    'music_visual_story_v1': ('Музыкальный клип', 'music_visual_story_v1'),
    'product_ad_v1': ('Реклама / продукт', 'product_ad_v1'),
    'story_monologue_v1': ('История / монолог', 'story_monologue_v1'),
}


def normalize_project_mode(value) -> dict:
    if isinstance(value, str):
        mode_id = value.strip() or DEFAULT_PROJECT_MODE['id']
    elif isinstance(value, dict):
        mode_id = str(value.get('id') or value.get('project_mode_id') or DEFAULT_PROJECT_MODE['id']).strip()
    else:
        mode_id = DEFAULT_PROJECT_MODE['id']
    label, contract_ref = PROJECT_MODE_LABELS.get(mode_id, PROJECT_MODE_LABELS[DEFAULT_PROJECT_MODE['id']])
    if mode_id not in PROJECT_MODE_LABELS:
        mode_id = DEFAULT_PROJECT_MODE['id']
    return {
        'id': mode_id,
        'label_ru': label,
        'version': 1,
        'contract_ref': contract_ref,
    }



def project_public(project: dict) -> dict:
    public = {k: v for k, v in project.items() if k != 'user_id'}
    public['project_mode'] = normalize_project_mode(public.get('project_mode'))
    return public


def state_richness(data: dict) -> int:
    if not isinstance(data, dict):
        return 0
    score = 0
    for key in ['audio', 'audio_file', 'scenes', 'phrases', 'board_scenes', 'videos', 'images', 'jobs', 'assets', 'final_video_url']:
        value = data.get(key)
        if value:
            score += 5 if isinstance(value, (list, dict)) else 3
    score += min(len(str(data)), 20000) // 1000
    return score


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

def build_project_summary(snapshots: dict) -> dict:
    manual = (snapshots.get('manual_timing') or {}).get('data') or {}
    podcast = (snapshots.get('podcast') or {}).get('data') or {}
    board = (snapshots.get('board') or {}).get('data') or {}
    assembly = (snapshots.get('board_assembly') or {}).get('data') or {}
    video_node = (snapshots.get('video_node') or {}).get('data') or {}
    video_node_project = video_node_snapshot_project(video_node)
    generator = (snapshots.get('generator') or {}).get('data') or {}

    board_scenes_count = count_items(board, ['board_scenes', 'scenes'])
    board_images_count = count_items(board, ['images', 'image_urls', 'generated_images'])
    board_videos_count = count_items(board, ['videos', 'video_urls', 'generated_videos'])

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
            'scenes_count': board_scenes_count,
            'images_count': board_images_count,
            'videos_count': board_videos_count,
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
    }


@router.get('')
def list_projects(user: dict = Depends(get_current_user)):
    db = store.get_db()
    projects = [
        project_public(p)
        for p in db['projects'].values()
        if p.get('user_id') == user['id'] and p.get('status') != 'deleted'
    ]
    projects.sort(key=lambda p: p.get('updated_at', ''), reverse=True)
    return {'projects': projects}


@router.post('')
def create_project(payload: ProjectCreateRequest, user: dict = Depends(get_current_user)):
    def op(db):
        user_projects = [
            p for p in db['projects'].values()
            if p.get('user_id') == user['id'] and p.get('status') != 'deleted'
        ]
        project_id = make_id('p')
        project = {
            'id': project_id,
            'user_id': user['id'],
            'name': payload.name.strip(),
            'type': payload.type,
            'format': payload.format,
            'description': payload.description,
            'project_mode': normalize_project_mode(payload.project_mode),
            'theme_index': len(user_projects) % PROJECT_THEME_COUNT,
            'status': 'draft',
            'created_at': now_iso(),
            'updated_at': now_iso(),
        }
        db['projects'][project_id] = project
        db['snapshots'][project_id] = {}
        return {'project': project_public(project)}
    return store.update(op)


@router.get('/{project_id}')
def get_project(project: dict = Depends(ensure_project_access)):
    if project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project deleted')
    return {'project': project_public(project)}


@router.get('/{project_id}/summary')
def get_project_summary(project: dict = Depends(ensure_project_access)):
    if project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project deleted')
    db = store.get_db()
    snapshots = db['snapshots'].get(project['id'], {})
    return {
        'project_id': project['id'],
        'summary': build_project_summary(snapshots),
        'updated_at': project.get('updated_at'),
    }


@router.patch('/{project_id}')
def update_project(payload: ProjectUpdateRequest, project: dict = Depends(ensure_project_access)):
    project_id = project['id']

    def op(db):
        p = db['projects'][project_id]
        if payload.name is not None:
            p['name'] = payload.name.strip()
        if payload.status is not None:
            p['status'] = payload.status
        if payload.description is not None:
            p['description'] = payload.description
        if payload.project_mode is not None:
            p['project_mode'] = normalize_project_mode(payload.project_mode)
        p['updated_at'] = now_iso()
        return {'project': project_public(p)}

    return store.update(op)


@router.delete('/{project_id}')
def delete_project(project: dict = Depends(ensure_project_access)):
    project_id = project['id']
    user_id = project.get('user_id')

    def op(db):
        cleanup = cleanup_project_media(db, project_id, user_id=user_id)
        return {'deleted': True, 'project_id': project_id, 'hard_deleted': True, 'cleanup': cleanup}

    return store.update(op)


@router.get('/{project_id}/snapshots/{stage}')
def get_snapshot(stage: str, project: dict = Depends(ensure_project_access)):
    if project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project deleted')
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')
    db = store.get_db()
    snapshot = db['snapshots'].get(project['id'], {}).get(stage)
    return {'snapshot': snapshot or {'stage': stage, 'data': {}, 'updated_at': None}}



# AVA_PROJECT_BOARD_PRESERVE_SERVER_BATCH_VIDEO_REFS_V131Q2
# Browser refresh/save can lag behind backend server batch and POST an older board
# snapshot with fewer video refs. Do not allow that stale POST to erase videos
# that server batch has already registered into the project snapshot.
_BOARD_VIDEO_REF_KEYS_V131Q2 = (
    "video_asset_id", "videoAssetId",
    "video_api_path", "videoApiPath",
    "video_url", "videoUrl",
    "video_static_url", "videoStaticUrl",
    "video_path", "videoPath",
    "result_video_asset_id", "resultVideoAssetId",
    "result_video_api_path", "resultVideoApiPath",
    "result_video_url", "resultVideoUrl",
)

_BOARD_VIDEO_STATE_KEYS_V131Q2 = _BOARD_VIDEO_REF_KEYS_V131Q2 + (
    "video_status", "videoStatus",
    "video_error", "videoError",
    "video_job_id", "videoJobId",
    "video_status_endpoint", "videoStatusEndpoint",
    "video_queue_position", "videoQueuePosition",
    "video_queue_source", "videoQueueSource",
    "video_review", "videoReview",
    "video_review_state", "videoReviewState",
    "video_ready_at", "videoReadyAt",
    "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
    "video_source_image_mutation_at", "videoSourceImageMutationAt",
    "last_video_job_id", "lastVideoJobId",
)

_BOARD_BATCH_KEYS_V131Q2 = (
    "video_batch", "videoBatch",
    "board_video_batch", "boardVideoBatch",
    "video_queue", "videoQueue",
)


def _ava_truthy_media_ref_v131q2(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        value = value.strip()
        return bool(value) and value.lower() not in {"null", "none", "undefined"}
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return bool(value)


def _ava_board_scenes_v131q2(data):
    if not isinstance(data, dict):
        return []
    scenes = data.get("scenes")
    if isinstance(scenes, list):
        return scenes
    board_scenes = data.get("board_scenes") or data.get("boardScenes")
    if isinstance(board_scenes, list):
        return board_scenes
    return []


def _ava_board_scene_id_v131q2(scene, index=None) -> str:
    if isinstance(scene, dict):
        value = scene.get("id") or scene.get("scene_id") or scene.get("sceneId") or scene.get("uid")
        if value:
            return str(value)
    return f"__idx_{index}" if index is not None else ""


def _ava_board_scene_has_video_ref_v131q2(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    for key in _BOARD_VIDEO_REF_KEYS_V131Q2:
        if _ava_truthy_media_ref_v131q2(scene.get(key)):
            return True
    result = scene.get("video_result") or scene.get("videoResult")
    if isinstance(result, dict):
        for key in _BOARD_VIDEO_REF_KEYS_V131Q2:
            if _ava_truthy_media_ref_v131q2(result.get(key)):
                return True
        for key in ("asset_id", "assetId", "api_path", "apiPath", "url"):
            if _ava_truthy_media_ref_v131q2(result.get(key)):
                return True
    return False


def _ava_board_video_ref_count_v131q2(data) -> int:
    return sum(1 for scene in _ava_board_scenes_v131q2(data) if _ava_board_scene_has_video_ref_v131q2(scene))


def _ava_board_has_server_batch_marker_v131q2(data) -> bool:
    if not isinstance(data, dict):
        return False
    for key in _BOARD_BATCH_KEYS_V131Q2:
        batch = data.get(key)
        if isinstance(batch, dict) and batch:
            status = str(batch.get("status") or batch.get("batch_status") or batch.get("video_status") or "").lower()
            if status or batch.get("batch_id") or batch.get("batchId") or batch.get("id"):
                return True
        if isinstance(batch, list) and batch:
            return True
    return False



# AVA_PROJECT_BOARD_PRESERVE_SKIP_CHANGED_IMAGE_V131R
# v131q2 protects server-batch video refs from stale frontend saves. However,
# when the user replaces/deletes scene images, the old video must NOT be
# preserved back onto the new image. This image identity guard keeps only video
# refs whose current snapshot image still matches the incoming scene image.
_BOARD_IMAGE_IDENTITY_KEYS_V131R = (
    "image_asset_id", "imageAssetId",
    "image_api_path", "imageApiPath",
    "image_url", "imageUrl",
    "photo_asset_id", "photoAssetId",
    "photo_api_path", "photoApiPath",
    "photo_url", "photoUrl",
    "first_image_asset_id", "firstImageAssetId",
    "first_image_api_path", "firstImageApiPath",
    "first_image_url", "firstImageUrl",
    "first_frame_asset_id", "firstFrameAssetId",
    "first_frame_api_path", "firstFrameApiPath",
    "first_frame_url", "firstFrameUrl",
    "start_image_asset_id", "startImageAssetId",
    "start_image_api_path", "startImageApiPath",
    "start_image_url", "startImageUrl",
    "media_asset_id", "mediaAssetId",
    "media_api_path", "mediaApiPath",
    "media_url", "mediaUrl",
)

_BOARD_IMAGE_OBJECT_KEYS_V131R = (
    "image", "photo", "media",
    "first_image", "firstImage",
    "first_frame", "firstFrame",
    "start_image", "startImage",
    "start_frame", "startFrame",
    "source_image", "sourceImage",
)


def _ava_norm_identity_value_v131r(value):
    if value is None:
        return ""
    if isinstance(value, str):
        value = value.strip()
        if not value or value.lower() in {"null", "none", "undefined"}:
            return ""
        return value
    if isinstance(value, dict):
        for key in (
            "asset_id", "assetId",
            "image_asset_id", "imageAssetId",
            "photo_asset_id", "photoAssetId",
            "api_path", "apiPath",
            "image_api_path", "imageApiPath",
            "photo_api_path", "photoApiPath",
            "url", "image_url", "imageUrl", "photo_url", "photoUrl",
        ):
            normalized = _ava_norm_identity_value_v131r(value.get(key))
            if normalized:
                return normalized
    return ""


def _ava_board_image_identity_values_v131r(scene) -> set[str]:
    values = set()
    if not isinstance(scene, dict):
        return values

    for key in _BOARD_IMAGE_IDENTITY_KEYS_V131R:
        normalized = _ava_norm_identity_value_v131r(scene.get(key))
        if normalized:
            values.add(normalized)

    for key in _BOARD_IMAGE_OBJECT_KEYS_V131R:
        normalized = _ava_norm_identity_value_v131r(scene.get(key))
        if normalized:
            values.add(normalized)

    return values


def _ava_board_image_epoch_v131r(scene):
    if not isinstance(scene, dict):
        return None
    for key in ("image_mutation_epoch", "imageMutationEpoch", "image_epoch", "imageEpoch"):
        value = scene.get(key)
        if value is None or value == "":
            continue
        try:
            return int(value)
        except Exception:
            return str(value)
    return None


def _ava_board_image_matches_for_video_preserve_v131r(current_scene, incoming_scene) -> bool:
    current_epoch = _ava_board_image_epoch_v131r(current_scene)
    incoming_epoch = _ava_board_image_epoch_v131r(incoming_scene)
    if current_epoch is not None and incoming_epoch is not None and current_epoch != incoming_epoch:
        return False

    current_values = _ava_board_image_identity_values_v131r(current_scene)
    incoming_values = _ava_board_image_identity_values_v131r(incoming_scene)

    # If both sides have durable image identity and they do not intersect, this is a
    # replaced image. Do not preserve old video onto the new image.
    if current_values and incoming_values and current_values.isdisjoint(incoming_values):
        return False

    # If neither side has identity, keep old v131q2 behavior because there is no safe
    # way to prove an image replacement happened.
    return True


def _ava_project_merge_server_batch_video_refs_v131q2(current_snapshot, incoming_data):
    if not isinstance(current_snapshot, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0

    current_data = current_snapshot.get("data") or {}
    current_client_version = str(current_snapshot.get("client_version") or "")

    current_is_server_batch = (
        current_client_version.startswith("board-server-video-batch")
        or _ava_board_has_server_batch_marker_v131q2(current_data)
    )
    if not current_is_server_batch:
        return incoming_data, 0

    current_count = _ava_board_video_ref_count_v131q2(current_data)
    incoming_count = _ava_board_video_ref_count_v131q2(incoming_data)
    if current_count <= incoming_count:
        return incoming_data, 0

    merged = copy.deepcopy(incoming_data)
    current_scenes = _ava_board_scenes_v131q2(current_data)
    merged_scenes = _ava_board_scenes_v131q2(merged)
    current_by_id = {
        _ava_board_scene_id_v131q2(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    for index, scene in enumerate(merged_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue
        if not _ava_board_scene_has_video_ref_v131q2(current_scene):
            continue
        if _ava_board_scene_has_video_ref_v131q2(scene):
            continue
        if not _ava_board_image_matches_for_video_preserve_v131r(current_scene, scene):
            print('[PROJECT BOARD SERVER VIDEO REF PRESERVE SKIPPED V131R]', {
                'scene_id': scene_id,
                'reason': 'image_changed',
                'currentImageRefs': sorted(_ava_board_image_identity_values_v131r(current_scene)),
                'incomingImageRefs': sorted(_ava_board_image_identity_values_v131r(scene)),
                'currentEpoch': _ava_board_image_epoch_v131r(current_scene),
                'incomingEpoch': _ava_board_image_epoch_v131r(scene),
            })
            continue

        for key in _BOARD_VIDEO_STATE_KEYS_V131Q2:
            if key in current_scene and _ava_truthy_media_ref_v131q2(current_scene.get(key)):
                scene[key] = copy.deepcopy(current_scene.get(key))

        result = current_scene.get("video_result") or current_scene.get("videoResult")
        if isinstance(result, dict):
            scene["video_result"] = copy.deepcopy(result)
            scene["videoResult"] = copy.deepcopy(result)
        if not scene.get("video_status") and not scene.get("videoStatus"):
            scene["video_status"] = "ready"
            scene["videoStatus"] = "ready"
        changed += 1

    for key in _BOARD_BATCH_KEYS_V131Q2:
        current_value = current_data.get(key)
        if current_value and not merged.get(key):
            merged[key] = copy.deepcopy(current_value)

    after_count = _ava_board_video_ref_count_v131q2(merged)
    if after_count <= incoming_count:
        return incoming_data, 0
    return merged, after_count - incoming_count


@router.post('/{project_id}/snapshots/{stage}')
def save_snapshot(stage: str, payload: SnapshotSaveRequest, project: dict = Depends(ensure_project_access)):
    if project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project deleted')
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')
    project_id = project['id']

    def op(db):
        db['snapshots'].setdefault(project_id, {})
        current = db['snapshots'][project_id].get(stage)
        cleanup = None
        is_destructive_clear = (
            payload.guard_mode == 'replace'
            and not (payload.data or {})
            and str(payload.client_version or '').startswith('workflow-stage-controls-clear')
        )
        if is_destructive_clear:
            cleanup = cleanup_project_stage_media(db, project_id, stage, user_id=project.get('user_id'))
        incoming_data, removed_runtime = sanitize_snapshot_runtime_media(payload.data or {})
        if payload.guard_mode == 'safe_merge' and current:
            old_score = state_richness(current.get('data') or {})
            new_score = state_richness(incoming_data)
            if old_score > 10 and new_score < max(3, old_score // 4):
                return {
                    'saved': False,
                    'reason': 'incoming_snapshot_too_poor_to_overwrite_saved_state',
                    'old_score': old_score,
                    'new_score': new_score,
                    'snapshot': current,
                }
            incoming_data, preserved_media_refs = preserve_media_refs(current.get('data') or {}, incoming_data)
        else:
            preserved_media_refs = 0

        board_server_video_preserved_v131q2 = 0
        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, board_server_video_preserved_v131q2 = _ava_project_merge_server_batch_video_refs_v131q2(
                current,
                incoming_data,
            )
            if board_server_video_preserved_v131q2:
                preserved_media_refs += board_server_video_preserved_v131q2
                print('[PROJECT BOARD SERVER VIDEO REFS PRESERVED V131Q2]', {
                    'project_id': project_id,
                    'stage': stage,
                    'incoming_client_version': payload.client_version,
                    'current_client_version': current.get('client_version'),
                    'preservedVideoRefs': board_server_video_preserved_v131q2,
                    **media_refs_summary(incoming_data),
                })

        print('[PROJECT SAVE MEDIA REFS SUMMARY]', {
            'scope': 'project',
            'project_id': project_id,
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
        db['snapshots'][project_id][stage] = snapshot
        db['projects'][project_id]['updated_at'] = now_iso()
        result = {'saved': True, 'snapshot': snapshot}
        if cleanup is not None:
            result['cleanup'] = cleanup
            result['hard_cleared'] = True
        return result

    return store.update(op)
