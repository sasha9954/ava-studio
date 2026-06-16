# AVA_PROJECT_REVIEW_ACCEPT_PERSIST_V132Z: accepted/cleared review state beats stale bad/needs_review preserve.
# AVA_PROJECT_RELOAD_SAVE_GUARD_V132W: preserve current server video refs even when reload autosave sends empty incoming refs during bad-review regeneration.
# AVA_PROJECT_FORCE_CLEAR_ON_CHANGED_IMAGE_V132M: clear old video/review state before preserve guards when scene image changes.
# AVA_PROJECT_CLEAR_REVIEW_VIDEO_ON_IMAGE_CHANGE_V132L: replacing scene image clears stale video/review states.
# AVA_PROJECT_REVIEW_PRESERVE_ALSO_VIDEO_REFS_V132K: review-preserve also preserves current video refs/status over stale saves.
# AVA_PROJECT_BATCH_BUSY_REVIEW_V132R: preserve old preview refs without downgrading active server-batch status or incoming needs_review.
# AVA_PROJECT_PRESERVE_CURRENT_BOUND_VIDEO_REFS_V132J_FIX: preserve current server video refs bound to current image over stale board saves.
# AVA_PROJECT_PRESERVE_NEEDS_REVIEW_VIDEO_REFS_V132H: preserve regenerated bad video refs together with needs_review over stale bad saves.
# AVA_PROJECT_NEEDS_REVIEW_BEATS_STALE_BAD_V132G: preserve needs_review over stale bad review saves.
# AVA_PROJECT_PRESERVE_BAD_REGEN_QUEUE_STATE_V132C: preserve bad-regeneration queued/running status across stale saves.
# AVA_FIX_LITERAL_BACKSLASH_NEWLINES_V132B_FIX: repaired literal backslash-n sequences from v132b patch.
# AVA_PROJECT_PRESERVE_REVIEW_STATE_V132B: preserve bad/needs_review review state across stale board saves.\n# AVA_PROJECT_BAD_REVIEW_SKIP_VIDEO_PRESERVE_V132A: bad-review scenes are allowed to drop old video refs for regeneration.
# AVA_PROJECT_BOARD_PRESERVE_SKIP_CHANGED_IMAGE_V131R: do not preserve old server-batch video refs after scene image replacement.
# AVA_PROJECT_BOARD_PRESERVE_SERVER_BATCH_VIDEO_REFS_V131Q2: backend protects server-batch video refs from stale board saves.
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



# AVA_PROJECT_BAD_REVIEW_SKIP_VIDEO_PRESERVE_V132A
# If the incoming board explicitly marks a scene as bad / bad-regeneration, do not
# let stale-save protection restore its old video refs.
def _ava_project_board_scene_bad_review_v132a(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    raw = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()
    if raw in {"bad", "poor", "reject", "rejected", "плохое", "плохая"}:
        return True
    if scene.get("video_review_regenerate_from_bad") or scene.get("videoReviewRegenerateFromBad"):
        return True
    if scene.get("video_reset_reason") == "bad_review_regeneration_started" or scene.get("videoResetReason") == "bad_review_regeneration_started":
        return True
    return False



# AVA_PROJECT_PRESERVE_REVIEW_STATE_V132B
# Stale frontend saves after server-batch completion may contain the new video refs
# but miss the freshly-written review state ("needs_review"). Preserve red/orange
# review states unless the incoming scene explicitly carries a newer review update.
_BOARD_REVIEW_STATE_KEYS_V132B = (
    "video_review_status", "videoReviewStatus",
    "review_status", "reviewStatus",
    "video_review_updated_at", "videoReviewUpdatedAt",
    "video_review_reason", "videoReviewReason",
    "video_review_regenerate_from_bad", "videoReviewRegenerateFromBad",
    "video_review_regenerate_reason", "videoReviewRegenerateReason",

    # AVA_PROJECT_PRESERVE_BAD_REGEN_QUEUE_STATE_V132C:
    # When a bad scene is regenerating, stale frontend saves must not erase the
    # queued/running status and make the old video look accepted/ready.
    "video_status", "videoStatus",
    "video_job_id", "videoJobId",
    "video_status_endpoint", "videoStatusEndpoint",
    "video_queue_source", "videoQueueSource",
    "video_queue_position", "videoQueuePosition",
    "video_reset_reason", "videoResetReason",
)


def _ava_project_review_status_v132b(scene) -> str:
    if not isinstance(scene, dict):
        return ""
    raw = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()
    if raw in {"bad", "poor", "reject", "rejected", "плохое", "плохая"}:
        return "bad"
    if raw in {"needs_review", "review", "check", "посмотри", "на проверку"}:
        return "needs_review"
    return ""


def _ava_project_review_updated_at_v132b(scene) -> str:
    if not isinstance(scene, dict):
        return ""
    return str(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or "").strip()


# AVA_PROJECT_REVIEW_ACCEPT_PERSIST_V132Z
def _ava_project_review_accept_cleared_v132z(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    raw = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()
    if raw in ('accepted', 'accept', 'cleared', 'clear', 'ok', 'good', 'хорошее', 'принято'):
        return True
    values = (
        scene.get("video_review_cleared_at"), scene.get("videoReviewClearedAt"),
        scene.get("video_review_accepted_at"), scene.get("videoReviewAcceptedAt"),
        scene.get("video_review_clear_token_v132y"), scene.get("videoReviewClearTokenV132Y"),
        scene.get("video_review_accept_token_v132z"), scene.get("videoReviewAcceptTokenV132Z"),
        scene.get("video_review_clear_reason"), scene.get("videoReviewClearReason"),
    )
    if any(str(value or "").strip() for value in values):
        return True
    reason = str(scene.get("video_review_reason") or scene.get("videoReviewReason") or "").strip().lower()
    return reason in ('manual_needs_review_accept_v132x', 'manual_needs_review_accept_v132z', 'manual_bad_accept_v132z', 'manual_bad_clear', 'manual_review_clear_v132y', 'manual_review_accept_v132z')


def _ava_project_clear_review_fields_v132z(scene) -> None:
    if not isinstance(scene, dict):
        return
    accepted_at = str(
        scene.get("video_review_accepted_at")
        or scene.get("videoReviewAcceptedAt")
        or scene.get("video_review_cleared_at")
        or scene.get("videoReviewClearedAt")
        or ""
    ).strip()
    reason = str(
        scene.get("video_review_clear_reason")
        or scene.get("videoReviewClearReason")
        or scene.get("video_review_reason")
        or scene.get("videoReviewReason")
        or "manual_review_accept_v132z"
    ).strip()
    for key in (
        "video_review_status", "videoReviewStatus", "review_status", "reviewStatus",
        "video_review_regenerate_reason", "videoReviewRegenerateReason",
    ):
        scene[key] = ""
    scene["video_review_regenerate_from_bad"] = False
    scene["videoReviewRegenerateFromBad"] = False
    scene["bad_video_review"] = False
    scene["badVideoReview"] = False
    scene["video_review_bad"] = False
    scene["videoReviewBad"] = False
    if accepted_at:
        scene["video_review_cleared_at"] = accepted_at
        scene["videoReviewClearedAt"] = accepted_at
        scene["video_review_accepted_at"] = accepted_at
        scene["videoReviewAcceptedAt"] = accepted_at
    if reason:
        scene["video_review_clear_reason"] = reason
        scene["videoReviewClearReason"] = reason
        scene["video_review_reason"] = reason
        scene["videoReviewReason"] = reason


def _ava_project_scene_video_identity_v132b(scene) -> set[str]:
    values = set()
    if not isinstance(scene, dict):
        return values
    for key in (
        "video_asset_id", "videoAssetId",
        "video_api_path", "videoApiPath",
        "video_url", "videoUrl",
        "result_video_asset_id", "resultVideoAssetId",
        "result_video_api_path", "resultVideoApiPath",
        "result_video_url", "resultVideoUrl",
    ):
        value = scene.get(key)
        if isinstance(value, str) and value.strip():
            values.add(value.strip())
    result = scene.get("video_result") or scene.get("videoResult")
    if isinstance(result, dict):
        for key in ("asset_id", "assetId", "videoAssetId", "video_asset_id", "api_path", "apiPath", "url"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                values.add(value.strip())
    return values


def _ava_project_preserve_review_state_v132b(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0

    current_scenes = _ava_board_scenes_v131q2(current_data) if "_ava_board_scenes_v131q2" in globals() else []
    incoming_scenes = _ava_board_scenes_v131q2(incoming_data) if "_ava_board_scenes_v131q2" in globals() else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_board_scene_id_v131q2(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_board_scenes_v131q2(next_data)
    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        current_review = _ava_project_review_status_v132b(current_scene)
        incoming_review = _ava_project_review_status_v132b(scene)

        if current_review in {"bad", "needs_review"} and _ava_project_review_accept_cleared_v132z(scene):
            _ava_project_clear_review_fields_v132z(scene)
            print('[PROJECT BOARD REVIEW ACCEPTED CLEAR WINS V132Z]', {
                'scene_id': scene_id,
                'currentReview': current_review,
                'incomingReview': incoming_review,
                'reason': scene.get("video_review_clear_reason") or scene.get("videoReviewClearReason") or scene.get("video_review_reason") or scene.get("videoReviewReason") or '',
            }, flush=True)
            changed += 1
            continue

        # AVA_PROJECT_NEEDS_REVIEW_BEATS_STALE_BAD_V132G:
        # If the server has already turned regenerated bad video into "needs_review",
        # a stale frontend save with old red "bad" must not overwrite it.
        if current_review not in {"bad", "needs_review"}:
            continue
        if incoming_review and not (current_review == "needs_review" and incoming_review == "bad"):
            continue

        current_video_ids = _ava_project_scene_video_identity_v132b(current_scene)
        incoming_video_ids = _ava_project_scene_video_identity_v132b(scene)

        # AVA_PROJECT_PRESERVE_NEEDS_REVIEW_VIDEO_REFS_V132H:
        # After a bad clip is regenerated, the server snapshot has the NEW video +
        # needs_review ("посмотри"). A stale frontend save can still contain the OLD
        # bad video ref and red "bad" review. In that case we must preserve not only
        # the review state, but also the current/new video refs.
        preserve_current_video_refs_v132h = bool(
            current_review == "needs_review"
            and current_video_ids
            and (
                incoming_review in {"", "bad"}
                or not incoming_video_ids
                or current_video_ids.isdisjoint(incoming_video_ids)
            )
        )

        if (
            current_video_ids
            and incoming_video_ids
            and current_video_ids.isdisjoint(incoming_video_ids)
            and not preserve_current_video_refs_v132h
        ):
            continue

        current_review_at = _ava_project_review_updated_at_v132b(current_scene)
        incoming_review_at = _ava_project_review_updated_at_v132b(scene)

        # If incoming has a newer review timestamp, treat it as an intentional user action
        # (for example user accepted the orange "посмотри" mark).
        if incoming_review_at and current_review_at and incoming_review_at > current_review_at:
            continue

        for key in _BOARD_REVIEW_STATE_KEYS_V132B:
            if key in current_scene:
                scene[key] = copy.deepcopy(current_scene.get(key))

        # AVA_PROJECT_REVIEW_PRESERVE_ALSO_VIDEO_REFS_V132K:
        # V132B preserves review state, but if it preserves only the review marker
        # while the incoming save is stale, it can drop the newly returned server video
        # and leave the UI stuck at "кадр готов" / "видео делается".
        # Therefore every V132B review-preserve also carries current video refs/status.
        current_video_ids_v132k = (
            _ava_project_scene_video_identity_v132b(current_scene)
            if "_ava_project_scene_video_identity_v132b" in globals()
            else set()
        )
        incoming_video_ids_v132k = (
            _ava_project_scene_video_identity_v132b(scene)
            if "_ava_project_scene_video_identity_v132b" in globals()
            else set()
        )
        if current_video_ids_v132k and "_BOARD_VIDEO_STATE_KEYS_V131Q2" in globals():
            for video_key_v132k in _BOARD_VIDEO_STATE_KEYS_V131Q2:
                if video_key_v132k in current_scene:
                    scene[video_key_v132k] = copy.deepcopy(current_scene.get(video_key_v132k))

            # If a server result is already present in the current snapshot, it is not
            # running anymore from project-save perspective. Clear stale queue flags.
            current_status_v132k = str(
                current_scene.get("video_status") or current_scene.get("videoStatus") or ""
            ).strip().lower()
            if current_status_v132k in {"ready", "done", "completed", "complete", "success"} or current_video_ids_v132k:
                scene["video_status"] = "ready"
                scene["videoStatus"] = "ready"
                scene["video_status_endpoint"] = ""
                scene["videoStatusEndpoint"] = ""
                scene["video_job_id"] = ""
                scene["videoJobId"] = ""
                scene["video_queue_position"] = None
                scene["videoQueuePosition"] = None
                scene["video_queue_source"] = current_scene.get("video_queue_source") or current_scene.get("videoQueueSource") or ""
                scene["videoQueueSource"] = scene["video_queue_source"]

            print('[PROJECT BOARD REVIEW VIDEO REFS PRESERVED V132K]', {
                'scene_id': scene_id,
                'currentReview': current_review,
                'incomingReview': incoming_review,
                'currentVideoRefs': sorted(current_video_ids_v132k),
                'incomingVideoRefs': sorted(incoming_video_ids_v132k),
            })

        if preserve_current_video_refs_v132h:
            for key in _BOARD_VIDEO_STATE_KEYS_V131Q2:
                if key in current_scene:
                    scene[key] = copy.deepcopy(current_scene.get(key))
            # Make sure stale bad/queued flags do not survive after the new result.
            scene["video_status"] = "ready"
            scene["videoStatus"] = "ready"
            scene["video_review_status"] = "needs_review"
            scene["videoReviewStatus"] = "needs_review"
            scene["review_status"] = "needs_review"
            scene["reviewStatus"] = "needs_review"
            scene["video_review_reason"] = scene.get("video_review_reason") or "bad_video_regenerated"
            scene["videoReviewReason"] = scene.get("videoReviewReason") or "bad_video_regenerated"
            scene["video_review_regenerate_from_bad"] = False
            scene["videoReviewRegenerateFromBad"] = False
            scene["video_review_regenerate_reason"] = ""
            scene["videoReviewRegenerateReason"] = ""
            print('[PROJECT BOARD NEEDS_REVIEW VIDEO REFS PRESERVED V132H]', {
                'scene_id': scene_id,
                'currentVideoRefs': sorted(current_video_ids),
                'incomingVideoRefs': sorted(incoming_video_ids),
            })
        changed += 1

    if changed:
        next_data["scenes"] = next_scenes
    return (next_data if changed else incoming_data), changed



# AVA_PROJECT_PRESERVE_CURRENT_BOUND_VIDEO_REFS_V132J_FIX
# If the current project snapshot already contains a server-batch video result
# bound to the current image, stale browser saves must not replace it with an
# older/missing video state. This fixes the "кадр готов" state after changing
# a photo and generating a new video.
_IMAGE_REF_KEYS_V132J_FIX = (
    "image_asset_id", "imageAssetId",
    "start_image_asset_id", "startImageAssetId",
    "first_image_asset_id", "firstImageAssetId",
    "photo_asset_id", "photoAssetId",
    "image_api_path", "imageApiPath",
    "start_image_api_path", "startImageApiPath",
    "first_image_api_path", "firstImageApiPath",
    "photo_api_path", "photoApiPath",
    "image_url", "imageUrl",
    "start_image_url", "startImageUrl",
    "first_image_url", "firstImageUrl",
    "photo_url", "photoUrl",
    "image_mutation_epoch", "imageMutationEpoch",
    "start_image_mutation_epoch", "startImageMutationEpoch",
    "first_image_mutation_epoch", "firstImageMutationEpoch",
)

_VIDEO_SOURCE_IMAGE_REF_KEYS_V132J_FIX = (
    "video_source_image_asset_id", "videoSourceImageAssetId",
    "video_source_image_api_path", "videoSourceImageApiPath",
    "video_source_image_url", "videoSourceImageUrl",
    "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
)


def _ava_project_ref_values_v132j_fix(value):
    refs = set()
    if isinstance(value, str) and value.strip():
        refs.add(value.strip())
    elif isinstance(value, (int, float)) and value:
        refs.add(str(value))
    elif isinstance(value, dict):
        for key in (
            "asset_id", "assetId", "imageAssetId", "image_asset_id",
            "api_path", "apiPath", "imageApiPath", "image_api_path",
            "url", "src", "path",
            "mutation_epoch", "mutationEpoch", "imageMutationEpoch", "image_mutation_epoch",
        ):
            refs.update(_ava_project_ref_values_v132j_fix(value.get(key)))
    return refs


def _ava_project_scene_image_identity_v132j_fix(scene):
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in _IMAGE_REF_KEYS_V132J_FIX:
        refs.update(_ava_project_ref_values_v132j_fix(scene.get(key)))
    for key in ("image", "photo", "first", "start", "startImage", "firstImage", "media"):
        refs.update(_ava_project_ref_values_v132j_fix(scene.get(key)))
    return refs


def _ava_project_video_source_image_identity_v132j_fix(scene):
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in _VIDEO_SOURCE_IMAGE_REF_KEYS_V132J_FIX:
        refs.update(_ava_project_ref_values_v132j_fix(scene.get(key)))
    return refs


def _ava_project_video_ids_v132j_fix(scene):
    if "_ava_project_scene_video_identity_v132b" in globals():
        return _ava_project_scene_video_identity_v132b(scene)
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in (
        "video_asset_id", "videoAssetId",
        "video_api_path", "videoApiPath",
        "video_url", "videoUrl",
        "result_video_asset_id", "resultVideoAssetId",
        "result_video_api_path", "resultVideoApiPath",
        "result_video_url", "resultVideoUrl",
    ):
        refs.update(_ava_project_ref_values_v132j_fix(scene.get(key)))
    return refs


def _ava_project_preserve_current_bound_video_refs_v132j_fix(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0

    current_scenes = _ava_board_scenes_v131q2(current_data) if "_ava_board_scenes_v131q2" in globals() else []
    incoming_scenes = _ava_board_scenes_v131q2(incoming_data) if "_ava_board_scenes_v131q2" in globals() else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_board_scene_id_v131q2(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_board_scenes_v131q2(next_data)

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue

        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        current_video_ids = _ava_project_video_ids_v132j_fix(current_scene)
        incoming_video_ids = _ava_project_video_ids_v132j_fix(scene)
        if not current_video_ids:
            continue

        source_image_ids = _ava_project_video_source_image_identity_v132j_fix(current_scene)
        if not source_image_ids:
            continue

        incoming_image_ids = _ava_project_scene_image_identity_v132j_fix(scene)
        current_image_ids = _ava_project_scene_image_identity_v132j_fix(current_scene)
        image_matches_current_video = bool(
            (incoming_image_ids and source_image_ids.intersection(incoming_image_ids))
            or (current_image_ids and source_image_ids.intersection(current_image_ids))
        )
        if not image_matches_current_video:
            continue

        incoming_same_video = bool(incoming_video_ids and not current_video_ids.isdisjoint(incoming_video_ids))
        stale_bad_or_running = bool(
            str(scene.get("video_queue_source") or scene.get("videoQueueSource") or "").lower() == "bad_review_regeneration"
            or scene.get("video_review_regenerate_from_bad")
            or scene.get("videoReviewRegenerateFromBad")
            or str(scene.get("video_status") or scene.get("videoStatus") or "").lower() in {"queued", "running", "processing", "starting", "submitting", "preparing"}
        )

        # If incoming already has the same current video and is not stale/running, leave it alone.
        if incoming_same_video and not stale_bad_or_running:
            continue

        # AVA_PROJECT_V132J_KEEP_INCOMING_BUSY_STATUS_V132R:
        # A server-batch start save can legitimately contain old video refs + incoming running/queued state.
        # Preserve the old preview refs, but do not downgrade that incoming busy state back to ready.
        incoming_status_before_preserve_v132r = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
        incoming_queue_source_before_preserve_v132r = str(scene.get("video_queue_source") or scene.get("videoQueueSource") or "").strip()
        incoming_job_id_before_preserve_v132r = scene.get("video_job_id") or scene.get("videoJobId") or ""
        incoming_status_endpoint_before_preserve_v132r = scene.get("video_status_endpoint") or scene.get("videoStatusEndpoint") or ""
        incoming_queue_position_before_preserve_v132r = scene.get("video_queue_position") if scene.get("video_queue_position") is not None else scene.get("videoQueuePosition")
        incoming_review_before_preserve_v132r = _ava_project_review_status_v132b(scene) if "_ava_project_review_status_v132b" in globals() else ""
        current_review_before_preserve_v132r = _ava_project_review_status_v132b(current_scene) if "_ava_project_review_status_v132b" in globals() else ""

        for key in _BOARD_VIDEO_STATE_KEYS_V131Q2:
            if key in current_scene:
                scene[key] = copy.deepcopy(current_scene.get(key))

        if "_BOARD_REVIEW_STATE_KEYS_V132B" in globals():
            # AVA_PROJECT_V132J_DO_NOT_OVERWRITE_INCOMING_NEEDS_REVIEW_V132R:
            # When ltx_board writes the regenerated result as needs_review, an older current bad mark
            # must not be copied back over it by the bound-video preserve guard.
            skip_current_review_copy_v132r = bool(
                incoming_review_before_preserve_v132r == "needs_review"
                and current_review_before_preserve_v132r == "bad"
            )
            if not skip_current_review_copy_v132r:
                for key in _BOARD_REVIEW_STATE_KEYS_V132B:
                    if key in current_scene:
                        scene[key] = copy.deepcopy(current_scene.get(key))

        incoming_active_preserve_v132r = bool(
            incoming_status_before_preserve_v132r in {"queued", "running", "processing", "starting", "preparing", "submitting", "queued_no_prompt_id"}
            or "server_batch" in incoming_queue_source_before_preserve_v132r.lower()
            or "bad_review_regeneration" in incoming_queue_source_before_preserve_v132r.lower()
        )
        if incoming_active_preserve_v132r:
            scene["video_status"] = incoming_status_before_preserve_v132r if incoming_status_before_preserve_v132r else "running"
            scene["videoStatus"] = scene["video_status"]
            scene["video_job_id"] = incoming_job_id_before_preserve_v132r
            scene["videoJobId"] = incoming_job_id_before_preserve_v132r
            scene["video_status_endpoint"] = incoming_status_endpoint_before_preserve_v132r
            scene["videoStatusEndpoint"] = incoming_status_endpoint_before_preserve_v132r
            scene["video_queue_position"] = incoming_queue_position_before_preserve_v132r
            scene["videoQueuePosition"] = incoming_queue_position_before_preserve_v132r
            scene["video_queue_source"] = incoming_queue_source_before_preserve_v132r or "server_batch_generation_v132r"
            scene["videoQueueSource"] = scene["video_queue_source"]
            scene["video_batch_active_v132r"] = True
            scene["videoBatchActiveV132R"] = True
        else:
            scene["video_status"] = current_scene.get("video_status") or current_scene.get("videoStatus") or "ready"
            scene["videoStatus"] = scene["video_status"]
        scene["video_source_preserved_v132j"] = True
        scene["videoSourcePreservedV132J"] = True

        changed += 1
        print('[PROJECT BOARD CURRENT BOUND VIDEO REFS PRESERVED V132J]', {
            'scene_id': scene_id,
            'currentVideoRefs': sorted(current_video_ids),
            'incomingVideoRefs': sorted(incoming_video_ids),
            'sourceImageRefs': sorted(source_image_ids),
            'incomingImageRefs': sorted(incoming_image_ids),
        })

    if changed:
        next_data["scenes"] = next_scenes
    return (next_data if changed else incoming_data), changed



# AVA_PROJECT_CLEAR_REVIEW_VIDEO_ON_IMAGE_CHANGE_V132L
# Replacing a scene photo must reset the old video/review state. Otherwise stale
# bad-review flags can make a normal generation look like bad_review_regeneration,
# or old ready/running statuses can leak into the new image.
_CLEAR_REVIEW_KEYS_V132L = (
    "video_review_status", "videoReviewStatus",
    "review_status", "reviewStatus",
    "video_review_reason", "videoReviewReason",
    "review_reason", "reviewReason",
    "video_review_updated_at", "videoReviewUpdatedAt",
    "video_review_regenerate_from_bad", "videoReviewRegenerateFromBad",
    "video_review_regenerate_reason", "videoReviewRegenerateReason",
    "bad_video_review", "badVideoReview",
    "video_review_bad", "videoReviewBad",
    "video_bad", "videoBad",
    "is_bad_video", "isBadVideo",
)

_CLEAR_VIDEO_KEYS_ON_IMAGE_CHANGE_V132L = (
    "video_asset_id", "videoAssetId",
    "video_api_path", "videoApiPath",
    "video_url", "videoUrl",
    "video_static_url", "videoStaticUrl",
    "video_path", "videoPath",
    "video_name", "videoName",
    "video_result", "videoResult",
    "result_video_asset_id", "resultVideoAssetId",
    "result_video_api_path", "resultVideoApiPath",
    "result_video_url", "resultVideoUrl",
    "video_source_image_asset_id", "videoSourceImageAssetId",
    "video_source_image_api_path", "videoSourceImageApiPath",
    "video_source_image_url", "videoSourceImageUrl",
    "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
    "video_source_bound_at", "videoSourceBoundAt",
)

_CLEAR_VIDEO_STATUS_KEYS_ON_IMAGE_CHANGE_V132L = (
    "video_status", "videoStatus",
    "video_job_id", "videoJobId",
    "video_status_endpoint", "videoStatusEndpoint",
    "video_queue_position", "videoQueuePosition",
    "video_queue_source", "videoQueueSource",
    "video_reset_reason", "videoResetReason",
    "video_error", "videoError",
)


def _ava_project_clear_review_video_on_image_change_v132l(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0

    if "_ava_board_scenes_v131q2" not in globals() or "_ava_board_scene_id_v131q2" not in globals():
        return incoming_data, 0
    if "_ava_project_scene_image_identity_v132j_fix" not in globals():
        return incoming_data, 0

    current_scenes = _ava_board_scenes_v131q2(current_data)
    incoming_scenes = _ava_board_scenes_v131q2(incoming_data)
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_board_scene_id_v131q2(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_board_scenes_v131q2(next_data)

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue

        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        current_image_ids = _ava_project_scene_image_identity_v132j_fix(current_scene)
        incoming_image_ids = _ava_project_scene_image_identity_v132j_fix(scene)
        if not incoming_image_ids:
            continue

        image_changed = bool(
            (not current_image_ids and incoming_image_ids)
            or (current_image_ids and incoming_image_ids and current_image_ids.isdisjoint(incoming_image_ids))
        )
        if not image_changed:
            continue

        for key in _CLEAR_REVIEW_KEYS_V132L:
            if key in scene:
                scene.pop(key, None)

        for key in _CLEAR_VIDEO_KEYS_ON_IMAGE_CHANGE_V132L:
            if key in scene:
                scene.pop(key, None)

        for key in _CLEAR_VIDEO_STATUS_KEYS_ON_IMAGE_CHANGE_V132L:
            if key in scene:
                scene.pop(key, None)

        scene["video_status"] = ""
        scene["videoStatus"] = ""
        scene["video_cleared_after_image_change_v132l"] = True
        scene["videoClearedAfterImageChangeV132L"] = True

        changed += 1
        print('[PROJECT BOARD REVIEW VIDEO CLEARED AFTER IMAGE CHANGE V132L]', {
            'scene_id': scene_id,
            'currentImageRefs': sorted(current_image_ids),
            'incomingImageRefs': sorted(incoming_image_ids),
        })

    if changed:
        next_data["scenes"] = next_scenes
    return (next_data if changed else incoming_data), changed



# AVA_PROJECT_FORCE_CLEAR_ON_CHANGED_IMAGE_V132M
# This must run BEFORE all video/review preserve guards. If a scene image asset/apiPath
# changed, old video/review/job fields are invalid and must not be preserved back.
_IMAGE_KEYS_V132M = (
    "image_asset_id", "imageAssetId",
    "image_api_path", "imageApiPath",
    "image_url", "imageUrl",
    "photo_asset_id", "photoAssetId",
    "photo_api_path", "photoApiPath",
    "photo_url", "photoUrl",
    "first_frame_asset_id", "firstFrameAssetId",
    "first_frame_api_path", "firstFrameApiPath",
    "first_frame_url", "firstFrameUrl",
    "first_image_asset_id", "firstImageAssetId",
    "first_image_api_path", "firstImageApiPath",
    "first_image_url", "firstImageUrl",
    "start_image_asset_id", "startImageAssetId",
    "start_image_api_path", "startImageApiPath",
    "start_image_url", "startImageUrl",
    "last_frame_asset_id", "lastFrameAssetId",
    "last_frame_api_path", "lastFrameApiPath",
    "last_frame_url", "lastFrameUrl",
    "last_image_asset_id", "lastImageAssetId",
    "last_image_api_path", "lastImageApiPath",
    "last_image_url", "lastImageUrl",
    "end_image_asset_id", "endImageAssetId",
    "end_image_api_path", "endImageApiPath",
    "end_image_url", "endImageUrl",
    "image_mutation_epoch", "imageMutationEpoch",
    "start_image_mutation_epoch", "startImageMutationEpoch",
    "first_image_mutation_epoch", "firstImageMutationEpoch",
    "last_image_mutation_epoch", "lastImageMutationEpoch",
)

_NESTED_IMAGE_KEYS_V132M = (
    "image", "photo", "firstImage", "startImage", "lastImage", "endImage",
)

_VIDEO_CLEAR_KEYS_V132M = (
    "video_asset_id", "videoAssetId",
    "video_api_path", "videoApiPath",
    "video_url", "videoUrl",
    "video_static_url", "videoStaticUrl",
    "video_path", "videoPath",
    "video_name", "videoName",
    "video_result", "videoResult",
    "result_video_asset_id", "resultVideoAssetId",
    "result_video_api_path", "resultVideoApiPath",
    "result_video_url", "resultVideoUrl",
    "result_video_name", "resultVideoName",
    "video_ready_at", "videoReadyAt",
    "original_video_url", "originalVideoUrl",
    "video_source_image_asset_id", "videoSourceImageAssetId",
    "video_source_image_api_path", "videoSourceImageApiPath",
    "video_source_image_url", "videoSourceImageUrl",
    "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
    "video_source_bound_at", "videoSourceBoundAt",
    "video_source_preserved_v132j", "videoSourcePreservedV132J",
)

_STATUS_CLEAR_KEYS_V132M = (
    "video_status", "videoStatus",
    "video_error", "videoError",
    "video_job_id", "videoJobId",
    "video_status_endpoint", "videoStatusEndpoint",
    "video_queue_position", "videoQueuePosition",
    "video_queue_source", "videoQueueSource",
    "video_reset_reason", "videoResetReason",
)

_REVIEW_CLEAR_KEYS_V132M = (
    "video_review_status", "videoReviewStatus",
    "review_status", "reviewStatus",
    "video_review_reason", "videoReviewReason",
    "review_reason", "reviewReason",
    "video_review_updated_at", "videoReviewUpdatedAt",
    "video_review_regenerate_from_bad", "videoReviewRegenerateFromBad",
    "video_review_regenerate_reason", "videoReviewRegenerateReason",
    "bad_video_review", "badVideoReview",
    "video_review_bad", "videoReviewBad",
    "video_bad", "videoBad",
    "is_bad_video", "isBadVideo",
)


def _ava_project_ref_values_v132m(value):
    refs = set()
    if isinstance(value, str) and value.strip():
        refs.add(value.strip())
    elif isinstance(value, (int, float)) and value:
        refs.add(str(value))
    elif isinstance(value, dict):
        for key in (
            "asset_id", "assetId",
            "api_path", "apiPath",
            "url", "src", "path",
            "mutation_epoch", "mutationEpoch",
            "image_asset_id", "imageAssetId",
            "image_api_path", "imageApiPath",
            "image_url", "imageUrl",
        ):
            refs.update(_ava_project_ref_values_v132m(value.get(key)))
    return refs


def _ava_project_scene_image_refs_v132m(scene):
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in _IMAGE_KEYS_V132M:
        refs.update(_ava_project_ref_values_v132m(scene.get(key)))
    for key in _NESTED_IMAGE_KEYS_V132M:
        refs.update(_ava_project_ref_values_v132m(scene.get(key)))
    return refs


def _ava_project_scene_video_refs_v132m(scene):
    if "_ava_project_scene_video_identity_v132b" in globals():
        return _ava_project_scene_video_identity_v132b(scene)
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in _VIDEO_CLEAR_KEYS_V132M:
        refs.update(_ava_project_ref_values_v132m(scene.get(key)))
    return refs


def _ava_project_force_clear_on_changed_image_v132m(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    if "_ava_board_scenes_v131q2" not in globals() or "_ava_board_scene_id_v131q2" not in globals():
        return incoming_data, 0

    current_scenes = _ava_board_scenes_v131q2(current_data)
    incoming_scenes = _ava_board_scenes_v131q2(incoming_data)
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_board_scene_id_v131q2(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_board_scenes_v131q2(next_data)

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        current_image_refs = _ava_project_scene_image_refs_v132m(current_scene)
        incoming_image_refs = _ava_project_scene_image_refs_v132m(scene)
        if not incoming_image_refs:
            continue

        current_video_refs = _ava_project_scene_video_refs_v132m(current_scene)
        incoming_video_refs = _ava_project_scene_video_refs_v132m(scene)

        image_changed = bool(
            (not current_image_refs and incoming_image_refs)
            or (current_image_refs and incoming_image_refs and current_image_refs.isdisjoint(incoming_image_refs))
        )
        if not image_changed:
            continue

        has_old_video_or_review = bool(
            current_video_refs
            or incoming_video_refs
            or any(current_scene.get(key) not in (None, "", False) for key in _REVIEW_CLEAR_KEYS_V132M + _STATUS_CLEAR_KEYS_V132M)
            or any(scene.get(key) not in (None, "", False) for key in _REVIEW_CLEAR_KEYS_V132M + _STATUS_CLEAR_KEYS_V132M)
        )
        if not has_old_video_or_review:
            continue

        for key in _VIDEO_CLEAR_KEYS_V132M + _STATUS_CLEAR_KEYS_V132M + _REVIEW_CLEAR_KEYS_V132M:
            scene.pop(key, None)

        scene["video_status"] = ""
        scene["videoStatus"] = ""
        scene["video_cleared_after_image_change_v132m"] = True
        scene["videoClearedAfterImageChangeV132M"] = True
        scene["video_reset_reason"] = "image_changed_clear_video_review_v132m"
        scene["videoResetReason"] = "image_changed_clear_video_review_v132m"

        changed += 1
        print('[PROJECT BOARD FORCE CLEAR ON CHANGED IMAGE V132M]', {
            'scene_id': scene_id,
            'currentImageRefs': sorted(current_image_refs),
            'incomingImageRefs': sorted(incoming_image_refs),
            'currentVideoRefs': sorted(current_video_refs),
            'incomingVideoRefs': sorted(incoming_video_refs),
        })

    if changed:
        next_data["scenes"] = next_scenes
    return (next_data if changed else incoming_data), changed


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
        if _ava_project_board_scene_bad_review_v132a(scene):
            # AVA_PROJECT_BAD_REGEN_KEEP_OLD_VIDEO_PREVIEW_V132W:
            # A bad-review regeneration intentionally keeps the old video visible while a new job runs.
            # Do not skip preserve here; otherwise a reload/autosave with incomingVideoRefs=[] can make
            # the frontend boot from a stripped scene until the next server refresh.
            scene['video_review_regenerate_from_bad'] = True
            scene['videoReviewRegenerateFromBad'] = True
            scene['video_review_regenerate_reason'] = scene.get('video_review_regenerate_reason') or 'bad_review_regeneration_preserve_old_preview_v132w'
            scene['videoReviewRegenerateReason'] = scene.get('videoReviewRegenerateReason') or 'bad_review_regeneration_preserve_old_preview_v132w'
            print('[PROJECT BOARD SERVER VIDEO REF PRESERVE BAD REGEN V132W]', {
                'scene_id': scene_id,
                'reason': 'bad_review_regeneration_keep_old_preview',
            })
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



# AVA_PROJECT_REVIEW_CLEAR_ON_IMAGE_CHANGE_V133B:
# Review state belongs to a concrete video result. When the user replaces the
# source image/frame, stale bad/needs_review/posmotri must not be preserved by
# media-ref guards from the previous video.
_BOARD_REVIEW_KEYS_V133B = (
    "video_review_status", "videoReviewStatus",
    "review_status", "reviewStatus",
    "video_review_reason", "videoReviewReason",
    "video_review_bad_reason", "videoReviewBadReason",
    "video_review_needs_review_reason", "videoReviewNeedsReviewReason",
    "needs_review", "needsReview",
)


def _ava_board_scene_review_reset_requested_v133b(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    for key in (
        "video_review_reset_on_image_change_v133b",
        "videoReviewResetOnImageChangeV133B",
        "videoStaleAfterImageChangeV129P",
        "video_stale_after_image_change_v129p",
    ):
        if scene.get(key) is True:
            return True

    reason_blob = " ".join(
        str(scene.get(key) or "")
        for key in (
            "saveMode",
            "save_mode",
            "mediaMutationReason",
            "media_mutation_reason",
            "video_review_clear_reason",
            "videoReviewClearReason",
        )
    ).lower()
    if "source_image_changed" in reason_blob or "image_changed" in reason_blob:
        return True

    debug = scene.get("video_source_image_debug") or scene.get("videoSourceImageDebug")
    if isinstance(debug, dict):
        debug_reason = str(debug.get("reason") or "").lower()
        if "image" in debug_reason and ("replace" in debug_reason or "changed" in debug_reason or "upload" in debug_reason):
            return True

    return False


def _ava_project_clear_review_on_image_change_v133b(data):
    if not isinstance(data, dict):
        return data, 0

    scenes = _ava_board_scenes_v131q2(data)
    if not isinstance(scenes, list):
        return data, 0

    changed = 0
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        if not _ava_board_scene_review_reset_requested_v133b(scene):
            continue

        had_review = any(scene.get(key) not in ("", None, False) for key in _BOARD_REVIEW_KEYS_V133B)
        for key in _BOARD_REVIEW_KEYS_V133B:
            if key in scene:
                scene[key] = ""

        scene["needs_review"] = False
        scene["needsReview"] = False
        scene["video_review_cleared_at"] = scene.get("video_review_cleared_at") or now_iso()
        scene["videoReviewClearedAt"] = scene.get("videoReviewClearedAt") or scene["video_review_cleared_at"]
        scene["video_review_clear_reason"] = "source_image_changed_v133b"
        scene["videoReviewClearReason"] = "source_image_changed_v133b"
        scene["video_review_reset_on_image_change_v133b"] = True
        scene["videoReviewResetOnImageChangeV133B"] = True
        changed += 1

        print("[PROJECT BOARD REVIEW CLEARED ON IMAGE CHANGE V133B]", {
            "scene_id": _ava_board_scene_id_v131q2(scene, index),
            "hadReview": had_review,
            "reason": "source_image_changed_v133b",
        })

    return data, changed


# AVA_PROJECT_BLOCK_STALE_V132J_AFTER_IMAGE_CHANGE_V133C:
# Final backend safety pass. Older V132J preserve can restore old video refs after a
# source photo/frame changed. If a scene is marked as image-changed and its video source
# epoch is older/missing, remove those stale video/review refs before saving snapshot.
_BOARD_STALE_VIDEO_CLEAR_KEYS_V133C = (
    "video_status", "videoStatus",
    "video_error", "videoError",
    "video_job_id", "videoJobId",
    "video_status_endpoint", "videoStatusEndpoint",
    "video_queue_position", "videoQueuePosition",

    "video_url", "videoUrl",
    "video_api_path", "videoApiPath",
    "video_asset_id", "videoAssetId",
    "video_name", "videoName",
    "original_video_url", "originalVideoUrl",
    "video_result", "videoResult",
    "video_ready_at", "videoReadyAt",

    "result_url", "resultUrl",
    "result_video_url", "resultVideoUrl",
    "result_video_api_path", "resultVideoApiPath",
    "result_video_asset_id", "resultVideoAssetId",
    "result_video_name", "resultVideoName",

    "video_source_image_asset_id", "videoSourceImageAssetId",
    "video_source_image_api_path", "videoSourceImageApiPath",
    "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
    "video_source_image_mutation_at", "videoSourceImageMutationAt",

    "mmaudio_status", "mmaudioStatus",
    "mmaudio_error", "mmaudioError",
    "mmaudio_job_id", "mmaudioJobId",
    "mmaudio_status_endpoint", "mmaudioStatusEndpoint",
    "mmaudio_video_url", "mmaudioVideoUrl",
    "mmaudio_video_api_path", "mmaudioVideoApiPath",
    "mmaudio_video_asset_id", "mmaudioVideoAssetId",
    "mmaudio_video_name", "mmaudioVideoName",
    "mmaudio_result", "mmaudioResult",
    "mmaudio_result_video_url", "mmaudioResultVideoUrl",
    "mmaudio_result_video_api_path", "mmaudioResultVideoApiPath",
    "mmaudio_result_video_asset_id", "mmaudioResultVideoAssetId",
    "mmaudio_ready_at", "mmaudioReadyAt",
    "mmaudio_source_video_url", "mmaudioSourceVideoUrl",
    "mmaudio_source_video_api_path", "mmaudioSourceVideoApiPath",

    "video_review_status", "videoReviewStatus",
    "review_status", "reviewStatus",
    "video_review_reason", "videoReviewReason",
    "video_review_bad_reason", "videoReviewBadReason",
    "video_review_needs_review_reason", "videoReviewNeedsReviewReason",
    "needs_review", "needsReview",
)


def _ava_project_int_epoch_v133c(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _ava_project_video_source_epoch_v133c(scene):
    if not isinstance(scene, dict):
        return None
    for key in (
        "video_source_image_mutation_epoch", "videoSourceImageMutationEpoch",
        "video_source_epoch", "videoSourceEpoch",
    ):
        value = _ava_project_int_epoch_v133c(scene.get(key))
        if value is not None:
            return value
    return None


def _ava_project_scene_image_changed_marker_v133c(scene):
    if not isinstance(scene, dict):
        return False

    for key in (
        "video_stale_after_image_change_v129p", "videoStaleAfterImageChangeV129P",
        "video_review_reset_on_image_change_v133b", "videoReviewResetOnImageChangeV133B",
        "image_uploading_v129q", "imageUploadingV129Q",
        "mediaMutationReplaceSave", "forceReplaceSave",
    ):
        if scene.get(key) is True:
            return True

    reason_blob = " ".join(
        str(scene.get(key) or "")
        for key in (
            "saveMode", "save_mode",
            "mediaMutationReason", "media_mutation_reason",
            "video_review_clear_reason", "videoReviewClearReason",
        )
    ).lower()
    if "image_changed" in reason_blob or "source_image_changed" in reason_blob or "replace_media" in reason_blob:
        return True

    debug = scene.get("video_source_image_debug") or scene.get("videoSourceImageDebug")
    if isinstance(debug, dict):
        reason = str(debug.get("reason") or "").lower()
        if "image" in reason and ("replace" in reason or "changed" in reason or "upload" in reason):
            return True

    return False


def _ava_project_scene_has_stale_video_after_image_change_v133c(scene):
    if not isinstance(scene, dict):
        return False
    if not _ava_board_scene_has_video_ref_v131q2(scene):
        return False

    image_epoch = _ava_board_image_epoch_v131r(scene)
    video_epoch = _ava_project_video_source_epoch_v133c(scene)

    # Strong proof: the video belongs to an older source image.
    if image_epoch is not None and video_epoch is not None:
        try:
            return int(video_epoch) < int(image_epoch)
        except Exception:
            return False

    # If image changed and video has no source epoch, it is unsafe to preserve old refs.
    if image_epoch is not None and _ava_project_scene_image_changed_marker_v133c(scene):
        return True

    return False


def _ava_project_clear_stale_v132j_video_refs_v133c(data):
    if not isinstance(data, dict):
        return data, 0

    scenes = _ava_board_scenes_v131q2(data)
    if not isinstance(scenes, list):
        return data, 0

    cleared = 0
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        if not _ava_project_scene_has_stale_video_after_image_change_v133c(scene):
            continue

        before_refs = []
        for key in _BOARD_STALE_VIDEO_CLEAR_KEYS_V133C:
            value = scene.get(key)
            if value not in ("", None, False, 0, [], {}):
                before_refs.append(key)

        for key in _BOARD_STALE_VIDEO_CLEAR_KEYS_V133C:
            if key in scene:
                if key in ("needs_review", "needsReview"):
                    scene[key] = False
                elif key in ("video_result", "videoResult", "mmaudio_result", "mmaudioResult"):
                    scene[key] = None
                elif key in ("video_queue_position", "videoQueuePosition"):
                    scene[key] = 0
                else:
                    scene[key] = ""

        scene["video_status"] = ""
        scene["videoStatus"] = ""
        scene["video_stale_after_image_change_v129p"] = True
        scene["videoStaleAfterImageChangeV129P"] = True
        scene["stale_video_refs_cleared_v133c"] = True
        scene["staleVideoRefsClearedV133C"] = True
        scene["stale_video_refs_cleared_reason_v133c"] = "image_changed_after_v132j_preserve"
        scene["staleVideoRefsClearedReasonV133C"] = "image_changed_after_v132j_preserve"
        cleared += 1

        print("[PROJECT BOARD STALE V132J VIDEO CLEARED V133C]", {
            "scene_id": _ava_board_scene_id_v131q2(scene, index),
            "imageEpoch": _ava_board_image_epoch_v131r(scene),
            "videoSourceEpoch": _ava_project_video_source_epoch_v133c(scene),
            "clearedKeys": before_refs[:20],
        })

    return data, cleared



# AVA_PROJECT_STALE_VIDEO_CLEAR_ONLY_CHANGED_SCENE_V133D:
# V133C was too broad: old image-change markers can remain on scenes from previous
# edits and then clear videos in untouched scenes.  This guard checks the current
# snapshot and allows stale-video clearing only for scenes whose image identity/epoch
# changed in THIS save.
def _ava_project_current_scene_by_id_v133d(current_snapshot):
    data = (current_snapshot or {}).get("data") if isinstance(current_snapshot, dict) else {}
    scenes = _ava_board_scenes_v131q2(data or {})
    result = {}
    for index, scene in enumerate(scenes):
        if isinstance(scene, dict):
            result[_ava_board_scene_id_v131q2(scene, index)] = scene
    return result


def _ava_project_scene_image_changed_in_this_save_v133d(current_scene, incoming_scene):
    if not isinstance(incoming_scene, dict):
        return False
    if not isinstance(current_scene, dict):
        # New scene: do not clear video refs here. New scenes should not have stale V132J refs.
        return False

    current_epoch = _ava_board_image_epoch_v131r(current_scene)
    incoming_epoch = _ava_board_image_epoch_v131r(incoming_scene)
    if current_epoch is not None and incoming_epoch is not None and current_epoch != incoming_epoch:
        return True

    current_values = _ava_board_image_identity_values_v131r(current_scene)
    incoming_values = _ava_board_image_identity_values_v131r(incoming_scene)
    if current_values and incoming_values and current_values.isdisjoint(incoming_values):
        return True

    return False


def _ava_project_clear_stale_v132j_video_refs_v133d(current_snapshot, data):
    if not isinstance(data, dict):
        return data, 0

    current_by_id = _ava_project_current_scene_by_id_v133d(current_snapshot)
    scenes = _ava_board_scenes_v131q2(data)
    if not isinstance(scenes, list):
        return data, 0

    cleared = 0
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue

        scene_id = _ava_board_scene_id_v131q2(scene, index)
        current_scene = current_by_id.get(scene_id)

        if not _ava_project_scene_image_changed_in_this_save_v133d(current_scene, scene):
            continue

        if not _ava_board_scene_has_video_ref_v131q2(scene):
            continue

        before_refs = []
        for key in _BOARD_STALE_VIDEO_CLEAR_KEYS_V133C:
            value = scene.get(key)
            if value not in ("", None, False, 0, [], {}):
                before_refs.append(key)

        for key in _BOARD_STALE_VIDEO_CLEAR_KEYS_V133C:
            if key in scene:
                if key in ("needs_review", "needsReview"):
                    scene[key] = False
                elif key in ("video_result", "videoResult", "mmaudio_result", "mmaudioResult"):
                    scene[key] = None
                elif key in ("video_queue_position", "videoQueuePosition"):
                    scene[key] = 0
                else:
                    scene[key] = ""

        scene["video_status"] = ""
        scene["videoStatus"] = ""
        scene["video_stale_after_image_change_v129p"] = True
        scene["videoStaleAfterImageChangeV129P"] = True
        scene["stale_video_refs_cleared_v133d"] = True
        scene["staleVideoRefsClearedV133D"] = True
        scene["stale_video_refs_cleared_reason_v133d"] = "image_changed_in_this_save"
        scene["staleVideoRefsClearedReasonV133D"] = "image_changed_in_this_save"
        cleared += 1

        print("[PROJECT BOARD STALE V132J VIDEO CLEARED V133D]", {
            "scene_id": scene_id,
            "currentImageRefs": sorted(_ava_board_image_identity_values_v131r(current_scene)),
            "incomingImageRefs": sorted(_ava_board_image_identity_values_v131r(scene)),
            "currentEpoch": _ava_board_image_epoch_v131r(current_scene),
            "incomingEpoch": _ava_board_image_epoch_v131r(scene),
            "clearedKeys": before_refs[:20],
        })

    return data, cleared


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
        # AVA_PROJECT_FORCE_CLEAR_ON_CHANGED_IMAGE_V132M must run before all preserve guards.
        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, cleared_changed_image_v132m = _ava_project_force_clear_on_changed_image_v132m(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if cleared_changed_image_v132m:
                print('[PROJECT BOARD FORCE CLEAR SUMMARY V132M]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedScenes': cleared_changed_image_v132m,
                    **media_refs_summary(incoming_data),
                })

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

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, preserved_review_state_v132b = _ava_project_preserve_review_state_v132b(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if preserved_review_state_v132b:
                preserved_media_refs += preserved_review_state_v132b
                print('[PROJECT BOARD REVIEW STATE PRESERVED V132B]', {
                    'project_id': project_id,
                    'stage': stage,
                    'preservedReviewStates': preserved_review_state_v132b,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, preserved_bound_video_refs_v132j = _ava_project_preserve_current_bound_video_refs_v132j_fix(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if preserved_bound_video_refs_v132j:
                preserved_media_refs += preserved_bound_video_refs_v132j
                print('[PROJECT BOARD BOUND VIDEO REFS PRESERVED SUMMARY V132J]', {
                    'project_id': project_id,
                    'stage': stage,
                    'preservedBoundVideoRefs': preserved_bound_video_refs_v132j,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, cleared_review_video_v132l = _ava_project_clear_review_video_on_image_change_v132l(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if cleared_review_video_v132l:
                print('[PROJECT BOARD IMAGE CHANGE CLEAR SUMMARY V132L]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedScenes': cleared_review_video_v132l,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, review_cleared_v133b = _ava_project_clear_review_on_image_change_v133b(incoming_data)
            if review_cleared_v133b:
                print('[PROJECT BOARD REVIEW CLEAR SUMMARY V133B]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedReviewStates': review_cleared_v133b,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, stale_video_cleared_v133d = _ava_project_clear_stale_v132j_video_refs_v133d(current, incoming_data)
            if stale_video_cleared_v133d:
                print('[PROJECT BOARD STALE V132J VIDEO CLEAR SUMMARY V133D]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedStaleVideoRefs': stale_video_cleared_v133d,
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
