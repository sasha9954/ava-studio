# AVA_PROJECT_BOARD_PREVIEW_REMARK_REVISION_AUTHORITY_V217C: newer revisioned Board preview remarks beat stale delayed saves.
# AVA_PROJECT_BOARD_VIDEO_REVISION_AUTHORITY_V218B: server-ready video refs survive stale browser/Telegram review saves.
# AVA_PROJECT_BOARD_PROMPT_REVISION_AUTHORITY_V218A: newer per-scene prompts survive concurrent media/replace saves.
# AVA_PROJECT_TELEGRAM_REVIEW_AUTHORITY_V216K3: newer Telegram bad is a human review event.
# AVA_BOARD_MEDIA_REDUCER_CONTRACT_V216A: revision-based Board media save authority.
# AVA_BACKEND_BOARD_MEDIA_SIMPLE_AUTHORITY_V215D: protect newer committed Board images from stale delayed saves.
# AVA_BOARD_QUEUE_SOURCECUT_VISIBILITY_LIPSYNC_PRIORITY_V209P: lip-sync contract wins over stale source_cut flags.
from typing import Any
# AVA_PROJECT_SERVER_REVIEW_EVENT_MEMORY_V136E: server remembers newest per-scene review event and blocks stale autosave revival.
# AVA_PROJECT_V132Z_DO_NOT_CLEAR_INCOMING_REVIEW_V136C: V132Z clear/accept cannot win when incoming still has bad/needs_review.
# AVA_PROJECT_REVIEW_IMAGE_RESET_ONESHOT_V136B: V133B image-change review reset is one-shot and never self-retriggers from clear_reason.
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
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.snapshot_media import media_refs_summary, preserve_media_refs, sanitize_snapshot_runtime_media
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.core.media_cleanup import cleanup_project_media, cleanup_project_stage_media
from app.schemas import ProjectCreateRequest, ProjectUpdateRequest, SnapshotSaveRequest
import copy
import threading
import time
from copy import deepcopy

router = APIRouter(prefix='/projects', tags=['projects'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator', 'audio_studio', 'rules_packs'}
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
    audio_studio = (snapshots.get('audio_studio') or {}).get('data') or {}

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
        'audio_studio': {
            'scenes_count': count_items(audio_studio, ['scenes']),
            'variants_count': sum(len((scene or {}).get('variants') or []) for scene in (audio_studio.get('scenes') or []) if isinstance(scene, dict)) if isinstance(audio_studio, dict) else 0,
            'applied_count': sum(1 for scene in (audio_studio.get('scenes') or []) if isinstance(scene, dict) and bool(scene.get('appliedVariantId') or scene.get('applied_variant_id'))),
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


# AVA_PROJECT_FAST_DELETE_BACKGROUND_V212Q
def _project_delete_background_cleanup_v212q(project_id: str, user_id: str | None = None) -> None:
    started = time.monotonic()
    try:
        print('[PROJECT DELETE BACKGROUND CLEANUP START V212Q]', {'project_id': project_id}, flush=True)

        def cleanup_op(db):
            cleanup = cleanup_project_media(db, project_id, user_id=user_id)
            return {
                'project_id': project_id,
                'background_cleanup': True,
                'cleanup': cleanup,
                'elapsed_ms': round((time.monotonic() - started) * 1000, 1),
            }

        result = store.update(cleanup_op)
        print('[PROJECT DELETE BACKGROUND CLEANUP DONE V212Q]', result, flush=True)
    except Exception as exc:
        print('[PROJECT DELETE BACKGROUND CLEANUP ERROR V212Q]', {'project_id': project_id, 'error': str(exc)}, flush=True)


@router.delete('/{project_id}')
def delete_project(project: dict = Depends(ensure_project_access)):
    # V212Q: return quickly to the UI, then remove heavy media/files in background.
    # The project disappears from the list immediately, while rmtree/assets cleanup no longer blocks the click.
    project_id = project['id']
    user_id = project.get('user_id')
    started = time.monotonic()

    def op(db):
        projects = db.setdefault('projects', {})
        snapshots = db.setdefault('snapshots', {})
        jobs = db.setdefault('jobs', {})

        snapshot_count = len((snapshots.get(project_id) or {}))
        projects.pop(project_id, None)
        snapshots.pop(project_id, None)

        # Remove direct project jobs now, but leave deep cleanup/path deletion for background.
        jobs_deleted = 0
        for job_id, job in list(jobs.items()):
            if str((job or {}).get('project_id') or (job or {}).get('projectId') or '') == project_id:
                jobs.pop(job_id, None)
                jobs_deleted += 1

        return {
            'deleted': True,
            'project_id': project_id,
            'hard_deleted': False,
            'fast_delete': True,
            'cleanup': {
                'mode': 'background_v212q',
                'snapshots_dropped_now': snapshot_count,
                'jobs_dropped_now': jobs_deleted,
            },
            'elapsed_ms': round((time.monotonic() - started) * 1000, 1),
        }

    result = store.update(op)
    print('[PROJECT DELETE FAST ACK V212Q]', result, flush=True)

    thread = threading.Thread(
        target=_project_delete_background_cleanup_v212q,
        args=(project_id, user_id),
        name=f'ava-project-delete-cleanup-{project_id}',
        daemon=True,
    )
    thread.start()
    return result




# AVA_SERVER_TIMING_AUTHORITY_BOARD_SNAPSHOT_V212S2
# Server-side guard for Manual Timing -> Board. Manual Timing is the authority for
# scene count/start/end/duration. If the user merges/splits scenes in Timing, stale
# Board snapshots must not keep old 3-second durations, old audio slices, or old videos.
def _ava_v212s2_as_list(value):
    return value if isinstance(value, list) else []


def _ava_v212s2_num(value, default=0.0):
    try:
        if value is None or value == '':
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _ava_v212s2_text(value):
    return str(value or '').strip()


def _ava_v212s2_scene_id(scene, index):
    if isinstance(scene, dict):
        return _ava_v212s2_text(scene.get('scene_id') or scene.get('id') or f"seg_{index + 1:02d}")
    return f"seg_{index + 1:02d}"


def _ava_v212s2_root(data):
    if not isinstance(data, dict):
        return {}
    for key in ('manualTiming', 'manual_timing', 'timing'):
        node = data.get(key)
        if isinstance(node, dict) and isinstance(node.get('scenes'), list):
            return node
    return data


def _ava_v212s2_scenes(data):
    if not isinstance(data, dict):
        return []
    root = _ava_v212s2_root(data)
    for node in (root, data):
        if isinstance(node, dict) and isinstance(node.get('scenes'), list):
            return node.get('scenes') or []
        if isinstance(node, dict) and isinstance((node.get('production') or {}).get('scenes'), list):
            return (node.get('production') or {}).get('scenes') or []
    board = data.get('board') if isinstance(data.get('board'), dict) else None
    if board and isinstance(board.get('scenes'), list):
        return board.get('scenes') or []
    return []


def _ava_v212s2_scene_times(scene, index):
    scene = scene if isinstance(scene, dict) else {}
    start = _ava_v212s2_num(scene.get('start_sec', scene.get('start', scene.get('target_t0', scene.get('t0', 0)))), 0)
    raw_end = scene.get('end_sec', scene.get('end', scene.get('target_t1', scene.get('t1'))))
    raw_duration = scene.get('duration_sec', scene.get('durationSec', scene.get('duration')))
    duration = _ava_v212s2_num(raw_duration, None) if raw_duration is not None else None
    end = _ava_v212s2_num(raw_end, None) if raw_end is not None else None
    if duration is None and end is not None:
        duration = max(0.0, end - start)
    if end is None and duration is not None:
        end = start + duration
    if duration is None:
        duration = 0.0
    if end is None:
        end = start + duration

    # V212S3: after the user merges scenes in Manual Timing, one stale field may remain
    # from the first old scene: end_sec=2.47, while duration_sec/audio duration is 13.5.
    # If end-start and duration disagree, prefer duration and make the end consistent.
    span = max(0.0, end - start)
    if duration > 0.0 and abs(span - duration) > 0.05:
        end = start + duration

    return (round(start, 3), round(end, 3), round(duration, 3))

def _ava_v212s2_scene_signature(data):
    scenes = _ava_v212s2_scenes(data)
    signature = []
    for index, scene in enumerate(scenes):
        signature.append((_ava_v212s2_scene_id(scene, index), *_ava_v212s2_scene_times(scene, index)))
    return signature


def _ava_v212s2_signatures_differ(manual_data, board_data, eps=0.035):
    manual_sig = _ava_v212s2_scene_signature(manual_data)
    board_sig = _ava_v212s2_scene_signature(board_data)
    if not manual_sig:
        return False, manual_sig, board_sig
    if len(manual_sig) != len(board_sig):
        return True, manual_sig, board_sig
    for left, right in zip(manual_sig, board_sig):
        if left[0] != right[0]:
            return True, manual_sig, board_sig
        for i in (1, 2, 3):
            if abs(float(left[i]) - float(right[i])) > eps:
                return True, manual_sig, board_sig
    return False, manual_sig, board_sig


_AVA_V212S2_STALE_MEDIA_KEYS = {
    # generated/source video refs and status
    'video_url', 'videoUrl', 'video_api_path', 'videoApiPath', 'video_static_url', 'videoStaticUrl',
    'video_path', 'videoPath', 'video_asset_id', 'videoAssetId', 'video_name', 'videoName',
    'video_result', 'videoResult', 'result_video_url', 'resultVideoUrl', 'result_video_api_path', 'resultVideoApiPath',
    'result_video_asset_id', 'resultVideoAssetId', 'last_video_job_id', 'lastVideoJobId', 'video_job_id', 'videoJobId',
    'video_status_endpoint', 'videoStatusEndpoint', 'video_review', 'videoReview', 'video_review_state', 'videoReviewState',
    'video_review_status', 'videoReviewStatus', 'video_error', 'videoError', 'video_queue_position', 'videoQueuePosition',
    'video_queue_source', 'videoQueueSource', 'video_ready_at', 'videoReadyAt',
    # old per-scene audio slices become invalid after timing merge/split
    'audio_slice_url', 'audioSliceUrl', 'audio_slice_api_path', 'audioSliceApiPath', 'audio_slice_asset_id', 'audioSliceAssetId',
    'audio_slice_name', 'audioSliceName', 'audio_slice_duration', 'audioSliceDuration', 'audio_slice_status', 'audioSliceStatus',
    'audio_slice_error', 'audioSliceError', 'manual_lipsync_audio_url', 'manualLipSyncAudioUrl',
    'manual_lipsync_audio_api_path', 'manualLipSyncAudioApiPath', 'manual_lipsync_audio_asset_id', 'manualLipSyncAudioAssetId',
    'manual_lipsync_audio_name', 'manualLipSyncAudioName', 'manual_lipsync_audio_duration', 'manualLipSyncAudioDuration',
    # MMA/output refs tied to old scene media
    'mmaudio_video_api_path', 'mmaudioVideoApiPath', 'mmaudio_video_url', 'mmaudioVideoUrl', 'source_is_mmaudio', 'sourceIsMmaudio',
}

_AVA_V212S2_BOARD_LEVEL_STALE_KEYS = {
    'jobs', 'completedJobs', 'completed_jobs', 'videoJobs', 'video_jobs', 'pendingJobs', 'runningJobs',
    'videoBatch', 'video_batch', 'boardVideoBatch', 'board_video_batch', 'videoQueue', 'video_queue',
}


def _ava_v212s2_clear_stale_scene_media(scene):
    if not isinstance(scene, dict):
        return {}
    next_scene = dict(scene)
    for key in _AVA_V212S2_STALE_MEDIA_KEYS:
        if key in next_scene:
            next_scene.pop(key, None)
    next_scene['video_status'] = 'empty'
    next_scene['videoStatus'] = 'empty'
    next_scene['audio_slice_status'] = 'empty'
    next_scene['audioSliceStatus'] = 'empty'
    next_scene['timingAuthorityClearedMediaV212S2'] = True
    return next_scene


def _ava_v212s2_apply_manual_scene_timing(saved_scene, manual_scene, index, clear_stale_media=False):
    saved_scene = saved_scene if isinstance(saved_scene, dict) else {}
    manual_scene = manual_scene if isinstance(manual_scene, dict) else {}
    base = dict(saved_scene)
    if clear_stale_media:
        base = _ava_v212s2_clear_stale_scene_media(base)
    scene_id = _ava_v212s2_scene_id(manual_scene, index)
    start, end, duration = _ava_v212s2_scene_times(manual_scene, index)
    # Keep user prompts/notes/images, but force timing/route/block from Manual Timing.
    base.update({
        'id': scene_id,
        'scene_id': scene_id,
        'index': index,
        'start': start,
        'start_sec': start,
        'target_t0': start,
        'end': end,
        'end_sec': end,
        'target_t1': end,
        'duration': duration,
        'duration_sec': duration,
        'durationSec': duration,
        'timingAuthorityV212S2': True,
        'timingAuthorityAppliedAtV212S2': now_iso(),
    })
    for key in ('route', 'planned_route', 'plannedRoute', 'format', 'aspect_ratio', 'aspectRatio', 'output_format', 'outputFormat',
                'blockId', 'block_id', 'blockTitle', 'block_title', 'blockColor', 'block_color', 'color', 'sceneColor', 'scene_color'):
        if manual_scene.get(key) not in (None, ''):
            base[key] = manual_scene.get(key)
    return base



# AVA_SERVER_BOARD_TIMING_AUTHORITY_USER_EDIT_GUARD_V212U
# Manual Timing authority should repair stale timing for the same scene set, but it
# must not overwrite actual Board edits such as clear board or +scene. If scene count
# or ids differ, treat it as Board user state and do not collapse it to Manual Timing.

# AVA_SERVER_BOARD_MANUAL_EDIT_MARKER_GUARD_V212V
# V212U handled clear / scene-count changes. This handles the first +Scene save:
# it can still be one scene with the same id as Manual Timing, but it is explicitly
# a manual Board scene. Timing authority must never collapse manual Board edits.
def _ava_v212v_board_has_user_edit_markers(data):
    try:
        scenes = _ava_v212s2_scenes(data or {})
    except Exception:
        scenes = []
    if not scenes:
        return False
    marker_keys = (
        'source', 'importedFrom', 'imported_from', 'source_kind', 'sourceKind',
        'scene_type', 'sceneType', 'durationSource', 'duration_source',
        'timingSource', 'timing_source',
    )
    for scene in scenes:
        if not isinstance(scene, dict):
            continue
        marker_text = ' '.join(str(scene.get(key) or '').lower() for key in marker_keys)
        if 'manual_board' in marker_text or 'manual_board_scene' in marker_text:
            return True
        if scene.get('manual') is True or scene.get('isManual') is True or scene.get('is_manual') is True:
            return True
    return False


def _ava_v212v_skip_reason_for_data(data, manual_sig, board_sig):
    if _ava_v212v_board_has_user_edit_markers(data):
        return 'manual_board_user_edit_marker_v212v'
    return _ava_v212u_skip_reason(manual_sig, board_sig)

def _ava_v212u_can_apply_manual_timing_authority(manual_sig, board_sig):
    if not manual_sig or not board_sig:
        return False
    if len(manual_sig) != len(board_sig):
        return False
    try:
        for index, manual_item in enumerate(manual_sig):
            if str(manual_item[0] if manual_item else '') != str(board_sig[index][0] if board_sig[index] else ''):
                return False
    except Exception:
        return False
    return True


def _ava_v212u_skip_reason(manual_sig, board_sig):
    if not board_sig:
        return 'empty_or_cleared_board_user_state'
    if not manual_sig:
        return 'missing_manual_timing_signature'
    if len(manual_sig) != len(board_sig):
        return 'scene_count_changed_by_board_user_edit'
    try:
        for index, manual_item in enumerate(manual_sig):
            if str(manual_item[0] if manual_item else '') != str(board_sig[index][0] if board_sig[index] else ''):
                return 'scene_ids_changed_by_board_user_edit'
    except Exception:
        return 'signature_compare_failed'
    return 'unknown'


_AVA_V212U_IMAGE_MEDIA_KEYS = (
    'image_asset_id', 'imageAssetId', 'image_api_path', 'imageApiPath', 'image_url', 'imageUrl',
    'image_name', 'imageName', 'image_status', 'imageStatus', 'mediaUrl', 'media_url',
    'first_frame_url', 'firstFrameUrl', 'first_image_asset_id', 'firstImageAssetId', 'first_image_api_path', 'firstImageApiPath', 'first_image_url', 'firstImageUrl', 'first_image_name', 'firstImageName',
    'start_image_asset_id', 'startImageAssetId', 'start_image_api_path', 'startImageApiPath', 'start_image_url', 'startImageUrl', 'start_image_name', 'startImageName',
    'last_frame_url', 'lastFrameUrl', 'last_image_asset_id', 'lastImageAssetId', 'last_image_api_path', 'lastImageApiPath', 'last_image_url', 'lastImageUrl', 'last_image_name', 'lastImageName',
    'end_image_asset_id', 'endImageAssetId', 'end_image_api_path', 'endImageApiPath', 'end_image_url', 'endImageUrl', 'end_image_name', 'endImageName',
)

_AVA_V212U_VIDEO_MEDIA_KEYS = (
    'video_asset_id', 'videoAssetId', 'video_api_path', 'videoApiPath', 'video_url', 'videoUrl',
    'video_static_url', 'videoStaticUrl', 'video_path', 'videoPath', 'video_name', 'videoName',
    'result_video_asset_id', 'resultVideoAssetId', 'result_video_api_path', 'resultVideoApiPath', 'result_video_url', 'resultVideoUrl',
    'video_result', 'videoResult', 'resultUrl', 'result_url', 'original_video_url', 'originalVideoUrl',
    'video_status', 'videoStatus', 'video_ready_at', 'videoReadyAt', 'video_error', 'videoError',
    'video_review_status', 'videoReviewStatus', 'review_status', 'reviewStatus',
    'last_video_job_id', 'lastVideoJobId', 'video_job_id', 'videoJobId', 'video_status_endpoint', 'videoStatusEndpoint',
)


def _ava_v212u_has_value(value):
    if value is None or value == '' or value is False:
        return False
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def _ava_v212u_scene_has_any(scene, keys):
    if not isinstance(scene, dict):
        return False
    return any(_ava_v212u_has_value(scene.get(key)) for key in keys)


def _ava_v212u_copy_missing_media_keys(target, source, keys):
    if not isinstance(target, dict) or not isinstance(source, dict):
        return 0
    copied = 0
    for key in keys:
        if _ava_v212u_has_value(target.get(key)):
            continue
        if not _ava_v212u_has_value(source.get(key)):
            continue
        target[key] = deepcopy(source.get(key))
        copied += 1
    return copied


def _ava_v212u_video_timing_compatible(current_scene, next_scene):
    try:
        current_start, current_end, current_duration = _ava_v212s2_scene_times(current_scene or {}, 0)
        next_start, next_end, next_duration = _ava_v212s2_scene_times(next_scene or {}, 0)
        if current_duration <= 0 or next_duration <= 0:
            return False
        return abs(current_duration - next_duration) <= 0.85 and abs(current_end - next_end) <= 0.85
    except Exception:
        return False


def _ava_v212u_preserve_board_media_after_timing_authority(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    current_scenes = _ava_v212s2_scenes(current_data)
    incoming_scenes = _ava_v212s2_scenes(incoming_data)
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0
    current_by_id = {
        _ava_v212s2_scene_id(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }
    next_data = deepcopy(incoming_data)
    next_scenes = _ava_v212s2_scenes(next_data)
    preserved_images = 0
    preserved_videos = 0
    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_v212s2_scene_id(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue
        if not _ava_v212u_scene_has_any(scene, _AVA_V212U_IMAGE_MEDIA_KEYS) and _ava_v212u_scene_has_any(current_scene, _AVA_V212U_IMAGE_MEDIA_KEYS):
            if _ava_v212u_copy_missing_media_keys(scene, current_scene, _AVA_V212U_IMAGE_MEDIA_KEYS):
                preserved_images += 1
        if (
            not _ava_v212u_scene_has_any(scene, _AVA_V212U_VIDEO_MEDIA_KEYS)
            and _ava_v212u_scene_has_any(current_scene, _AVA_V212U_VIDEO_MEDIA_KEYS)
            and _ava_v212u_video_timing_compatible(current_scene, scene)
        ):
            if _ava_v212u_copy_missing_media_keys(scene, current_scene, _AVA_V212U_VIDEO_MEDIA_KEYS):
                preserved_videos += 1
        if preserved_images or preserved_videos:
            scene['boardMediaPreservedAfterTimingAuthorityV212U'] = True
            scene['board_media_preserved_after_timing_authority_v212u'] = True
    total = preserved_images + preserved_videos
    if total:
        next_data['boardMediaPreservedAfterTimingAuthorityV212U'] = True
        next_data['boardMediaPreservedCountsV212U'] = {'images': preserved_images, 'videos': preserved_videos}
    return next_data, total


def _ava_v212s2_apply_manual_timing_to_board(board_data, manual_data, clear_stale_media=False):
    if not isinstance(manual_data, dict):
        return board_data, False, 'no_manual_data'
    manual_scenes = _ava_v212s2_scenes(manual_data)
    if not manual_scenes:
        return board_data, False, 'no_manual_scenes'
    board_data = deepcopy(board_data) if isinstance(board_data, dict) else {}
    board_scenes = _ava_v212s2_scenes(board_data)
    saved_by_id = {_ava_v212s2_scene_id(scene, idx): scene for idx, scene in enumerate(board_scenes) if isinstance(scene, dict)}
    next_scenes = []
    for index, manual_scene in enumerate(manual_scenes):
        scene_id = _ava_v212s2_scene_id(manual_scene, index)
        next_scenes.append(_ava_v212s2_apply_manual_scene_timing(saved_by_id.get(scene_id, {}), manual_scene, index, clear_stale_media=clear_stale_media))

    for key in _AVA_V212S2_BOARD_LEVEL_STALE_KEYS:
        if clear_stale_media and key in board_data:
            board_data.pop(key, None)
    board_data['scenes'] = next_scenes
    board_data['selectedSceneId'] = next_scenes[0].get('scene_id') if next_scenes else board_data.get('selectedSceneId')
    board_data['timingAuthorityV212S2'] = True
    board_data['timingAuthorityReasonV212S2'] = 'manual_timing_scene_signature_changed'
    board_data['timingAuthorityAppliedAtV212S2'] = now_iso()
    # Keep board-level audio locked to Manual Timing where present.
    manual_root = _ava_v212s2_root(manual_data)
    manual_audio = manual_data.get('audio') or manual_root.get('audio')
    if manual_audio:
        board_data['audio'] = manual_audio
    elif manual_root.get('audioDurationSec') or manual_root.get('audio_duration_sec'):
        audio = dict(board_data.get('audio') or {})
        audio['durationSec'] = _ava_v212s2_num(manual_root.get('audioDurationSec', manual_root.get('audio_duration_sec')), audio.get('durationSec', 0))
        board_data['audio'] = audio
    return board_data, True, 'manual_timing_scene_signature_changed'




# AVA_MANUAL_SINGLE_SCENE_DURATION_AUTHORITY_V212S3
# Normalizes Manual Timing when a merge leaves one scene with stale end_sec from the
# first old segment but correct total duration/audio duration. This must be fixed at
# Manual Timing save time, before Board imports/saves stale timing again.
def _ava_v212s3_audio_duration(data):
    if not isinstance(data, dict):
        return 0.0
    candidates = []
    for node in (data, data.get('timing') if isinstance(data.get('timing'), dict) else None,
                 data.get('manualTiming') if isinstance(data.get('manualTiming'), dict) else None,
                 data.get('manual_timing') if isinstance(data.get('manual_timing'), dict) else None):
        if not isinstance(node, dict):
            continue
        candidates.extend([
            node.get('audioDurationSec'), node.get('audio_duration_sec'), node.get('durationSec'), node.get('duration_sec')
        ])
        audio = node.get('audio') if isinstance(node.get('audio'), dict) else None
        if audio:
            candidates.extend([audio.get('durationSec'), audio.get('duration_sec'), audio.get('duration')])
    best = 0.0
    for value in candidates:
        try:
            if value is not None and value != '':
                best = max(best, float(value))
        except Exception:
            pass
    return best


def _ava_v212s3_set_scene_times(scene, start, end, duration):
    if not isinstance(scene, dict):
        return scene
    scene['start'] = round(start, 3)
    scene['start_sec'] = round(start, 3)
    scene['target_t0'] = round(start, 3)
    scene['end'] = round(end, 3)
    scene['end_sec'] = round(end, 3)
    scene['target_t1'] = round(end, 3)
    scene['duration'] = round(duration, 3)
    scene['duration_sec'] = round(duration, 3)
    scene['durationSec'] = round(duration, 3)
    scene['manualTimingNormalizedV212S3'] = True
    scene['manualTimingNormalizedAtV212S3'] = now_iso()
    return scene


def _ava_v212s3_normalize_one_scene_list(scene_list, audio_duration=0.0):
    if not isinstance(scene_list, list) or len(scene_list) != 1 or not isinstance(scene_list[0], dict):
        return False, {}
    scene = scene_list[0]
    start, end, duration = _ava_v212s2_scene_times(scene, 0)
    old_end = end
    old_duration = duration
    target_duration = duration
    target_end = end

    # If the whole audio is clearly longer than the single scene, the merged single
    # scene must cover the full audio, not the stale first segment.
    if audio_duration and audio_duration > 0:
        audio_based_duration = max(0.0, audio_duration - start)
        if audio_based_duration > target_duration + 0.25 or audio_duration > target_end + 0.25:
            target_duration = audio_based_duration
            target_end = start + target_duration

    # Also fix internally inconsistent end/duration pairs.
    if target_duration > 0 and abs((target_end - start) - target_duration) > 0.05:
        target_end = start + target_duration

    changed = abs(target_end - old_end) > 0.035 or abs(target_duration - old_duration) > 0.035
    if changed:
        _ava_v212s3_set_scene_times(scene, start, target_end, target_duration)
    return changed, {
        'oldEnd': old_end,
        'oldDuration': old_duration,
        'newEnd': round(target_end, 3),
        'newDuration': round(target_duration, 3),
        'audioDuration': round(audio_duration, 3) if audio_duration else 0,
    }


def _ava_v212s3_normalize_manual_timing_data(data):
    if not isinstance(data, dict):
        return data, False, {'reason': 'not_dict'}
    data = deepcopy(data)
    audio_duration = _ava_v212s3_audio_duration(data)
    changed_any = False
    details = []

    # Normalize all common scene containers in the snapshot. They often duplicate the
    # same timing scene in top-level scenes and timing.scenes.
    for label, node in [
        ('root', data),
        ('timing', data.get('timing') if isinstance(data.get('timing'), dict) else None),
        ('manualTiming', data.get('manualTiming') if isinstance(data.get('manualTiming'), dict) else None),
        ('manual_timing', data.get('manual_timing') if isinstance(data.get('manual_timing'), dict) else None),
    ]:
        if not isinstance(node, dict) or not isinstance(node.get('scenes'), list):
            continue
        changed, info = _ava_v212s3_normalize_one_scene_list(node.get('scenes'), audio_duration=audio_duration)
        if changed:
            changed_any = True
            details.append({'container': label, **info})

    # Keep storyBlocks consistent for the 1-scene merged case too.
    for key in ('storyBlocks', 'story_blocks'):
        blocks = data.get(key)
        if isinstance(blocks, list) and len(blocks) == 1 and isinstance(blocks[0], dict):
            block = blocks[0]
            scene_start, scene_end, scene_duration = _ava_v212s2_scene_times((data.get('scenes') or [{}])[0], 0) if isinstance(data.get('scenes'), list) and data.get('scenes') else (0.0, audio_duration, audio_duration)
            if abs(_ava_v212s2_num(block.get('end'), 0) - scene_end) > 0.035 or abs(_ava_v212s2_num(block.get('duration'), 0) - scene_duration) > 0.035:
                block['start'] = scene_start
                block['end'] = scene_end
                block['duration'] = scene_duration
                block['manualTimingNormalizedV212S3'] = True
                changed_any = True

    if changed_any:
        data['manualTimingNormalizedV212S3'] = True
        data['manualTimingNormalizedAtV212S3'] = now_iso()
    return data, changed_any, {'reason': 'single_scene_merged_duration_authority_v212s3', 'details': details[:4]}

def _ava_v212s2_board_snapshot_with_manual_authority(db, project_id, snapshot, persist=False):
    manual_snapshot = ((db.get('snapshots') or {}).get(project_id) or {}).get('manual_timing') or {}
    manual_data = manual_snapshot.get('data') if isinstance(manual_snapshot, dict) else {}
    board_data = (snapshot or {}).get('data') if isinstance(snapshot, dict) else {}
    changed, manual_sig, board_sig = _ava_v212s2_signatures_differ(manual_data or {}, board_data or {})
    if not changed:
        return snapshot, False, {'reason': 'no_drift', 'manualSig': manual_sig[:3], 'boardSig': board_sig[:3]}
    if _ava_v212v_board_has_user_edit_markers(board_data or {}) or not _ava_v212u_can_apply_manual_timing_authority(manual_sig, board_sig):
        return snapshot, False, {
            'reason': _ava_v212v_skip_reason_for_data(board_data or {}, manual_sig, board_sig),
            'manualSig': manual_sig[:3],
            'boardSig': board_sig[:3],
            'skippedByUserBoardEditV212U': True,
            'skippedByManualBoardMarkerV212V': _ava_v212v_board_has_user_edit_markers(board_data or {}),
        }
    next_data, applied, reason = _ava_v212s2_apply_manual_timing_to_board(board_data or {}, manual_data or {}, clear_stale_media=True)
    if not applied:
        return snapshot, False, {'reason': reason, 'manualSig': manual_sig[:3], 'boardSig': board_sig[:3]}
    next_data, preserved_v212u = _ava_v212u_preserve_board_media_after_timing_authority(board_data or {}, next_data or {})
    if preserved_v212u:
        print('[BOARD TIMING AUTHORITY GET MEDIA PRESERVED V212U]', {
            'project_id': project_id,
            'preservedMediaRefs': preserved_v212u,
            'manualSig': manual_sig[:3],
            'boardSig': board_sig[:3],
        }, flush=True)
    next_snapshot = {
        **(snapshot or {}),
        'stage': 'board',
        'data': next_data,
        'client_version': MARK,
        'updated_at': now_iso(),
    }
    if persist:
        db.setdefault('snapshots', {}).setdefault(project_id, {})['board'] = next_snapshot
        if project_id in db.get('projects', {}):
            db['projects'][project_id]['updated_at'] = now_iso()
    return next_snapshot, True, {'reason': reason, 'manualSig': manual_sig[:3], 'boardSig': board_sig[:3], 'sceneCount': len(_ava_v212s2_scenes(next_data))}

@router.get('/{project_id}/snapshots/{stage}')
def get_snapshot(
    project_id: str,
    stage: str,
    authorization: str | None = Header(default=None),
):
    # AVA_PROJECT_SNAPSHOT_SINGLE_DB_READ_V216R2:
    # Preserve the existing auth/access semantics while avoiding three whole-DB reads.
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing bearer token')
    token = authorization.split(' ', 1)[1].strip()
    context = store.get_project_snapshot_context(token, project_id, stage)

    session = context.get('session')
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')
    user = context.get('user')
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')
    project = context.get('project')
    if not project or project.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
    if project.get('status') == 'deleted':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project deleted')
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')

    timing = context.get('_timing_v216r2') or {}
    print('[PROJECT SNAPSHOT SINGLE DB READ V216R2]', {
        'project_id': project_id,
        'stage': stage,
        'lockWaitMs': timing.get('lock_wait_ms'),
        'dbReadMs': timing.get('db_read_ms'),
        'extractMs': timing.get('extract_ms'),
        'totalMs': timing.get('total_ms'),
    }, flush=True)

    snapshot = context.get('snapshot')
    if stage == 'board':
        board_read_context = {
            'snapshots': {
                project_id: {
                    'manual_timing': context.get('manual_timing_snapshot'),
                },
            },
        }
        snapshot, applied_v212s2, info_v212s2 = _ava_v212s2_board_snapshot_with_manual_authority(
            board_read_context,
            project_id,
            snapshot or {'stage': stage, 'data': {}, 'updated_at': None},
            persist=False,
        )
        if applied_v212s2:
            print('[BOARD TIMING AUTHORITY GET APPLIED V212S2]', {'project_id': project_id, **info_v212s2}, flush=True)
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

        # AVA_PROJECT_V132Z_DO_NOT_CLEAR_INCOMING_REVIEW_V136C:
        # If the incoming scene still explicitly says bad/needs_review, this is a review mark,
        # not a clear/accept event. Old source_image_changed_v133b clear_reason may still be
        # present on the same scene and must not erase the fresh incoming review status.
        if (
            current_review in {"bad", "needs_review"}
            and incoming_review not in {"bad", "needs_review"}
            and _ava_project_review_accept_cleared_v132z(scene)
        ):
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

        # AVA_PROJECT_SKIP_BOUND_VIDEO_PRESERVE_ON_REGEN_V155A:
        # When the frontend starts regeneration of a bad/ready video it first saves
        # a scene with video_status=starting and intentionally cleared video refs.
        # The old V132J bound-video guard restored the old video refs/review mark
        # into that starting snapshot, which made the UI think regeneration was
        # active/queued while no fresh job was bound. Do not preserve old video refs
        # into explicit active/regeneration snapshots that carry no incoming video.
        incoming_status_v155a = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
        incoming_queue_source_v155a = str(scene.get("video_queue_source") or scene.get("videoQueueSource") or "").strip().lower()
        incoming_reset_reason_v155a = str(scene.get("video_reset_reason") or scene.get("videoResetReason") or "").strip().lower()
        incoming_job_id_v155a = str(scene.get("video_job_id") or scene.get("videoJobId") or "").strip()
        incoming_status_endpoint_v155a = str(scene.get("video_status_endpoint") or scene.get("videoStatusEndpoint") or "").strip()
        incoming_is_regen_start_v155a = bool(
            incoming_status_v155a in {"queued", "running", "processing", "starting", "submitting", "preparing", "queued_no_prompt_id"}
            or "regeneration" in incoming_queue_source_v155a
            or "regenerate" in incoming_queue_source_v155a
            or "regeneration" in incoming_reset_reason_v155a
            or "regenerate" in incoming_reset_reason_v155a
            or scene.get("video_regeneration_started_v155a")
            or scene.get("videoRegenerationStartedV155A")
        )
        if incoming_video_ids and current_video_ids.isdisjoint(incoming_video_ids):
            # Incoming has a different fresh result video. Never replace it with
            # the previous video just because the source image identity matches.
            print('[PROJECT BOARD BOUND VIDEO PRESERVE SKIP NEW RESULT V155A]', {
                'scene_id': scene_id,
                'currentVideoRefs': sorted(current_video_ids),
                'incomingVideoRefs': sorted(incoming_video_ids),
                'status': incoming_status_v155a,
            })
            continue
        if incoming_is_regen_start_v155a and not incoming_video_ids:
            print('[PROJECT BOARD BOUND VIDEO PRESERVE SKIP REGEN START V155A]', {
                'scene_id': scene_id,
                'currentVideoRefs': sorted(current_video_ids),
                'status': incoming_status_v155a,
                'queueSource': incoming_queue_source_v155a,
                'resetReason': incoming_reset_reason_v155a,
                'hasJob': bool(incoming_job_id_v155a or incoming_status_endpoint_v155a),
            })
            continue

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
    """AVA_PROJECT_REVIEW_IMAGE_RESET_ONESHOT_V136B.

    This is a one-shot request only. Older code also looked at
    video_review_clear_reason == source_image_changed_v133b, and the clear pass
    wrote that same reason back into the scene. That made every later autosave
    look like a fresh image change and wiped manual "плохое" forever.
    """
    if not isinstance(scene, dict):
        return False

    for key in (
        "video_review_reset_on_image_change_v133b",
        "videoReviewResetOnImageChangeV133B",
    ):
        if scene.get(key) is True:
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
        scene["video_review_reset_on_image_change_v133b"] = False
        scene["videoReviewResetOnImageChangeV133B"] = False
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




# AVA_PROJECT_DIRECT_REVIEW_STATE_V136A
# One final authoritative review resolver for Board.
# Manual "плохое" and manual clear are compared by per-scene timestamps;
# media/video refs are never touched here.
def _ava_project_review_dt_v136a(value):
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _ava_project_review_status_direct_v136a(scene) -> str:
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


def _ava_project_review_event_direct_v136a(scene):
    if not isinstance(scene, dict):
        return None

    status = _ava_project_review_status_direct_v136a(scene)
    reason = str(
        scene.get("video_review_reason")
        or scene.get("videoReviewReason")
        or scene.get("video_review_clear_reason")
        or scene.get("videoReviewClearReason")
        or ""
    ).strip()

    updated_at = str(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or "").strip()
    cleared_at = str(scene.get("video_review_cleared_at") or scene.get("videoReviewClearedAt") or "").strip()
    accepted_at = str(scene.get("video_review_accepted_at") or scene.get("videoReviewAcceptedAt") or "").strip()

    if status in {"bad", "needs_review"}:
        at = updated_at or cleared_at or accepted_at or str(scene.get("updatedAt") or scene.get("updated_at") or "").strip() or now_iso()
        return {
            "kind": "mark",
            "status": status,
            "reason": reason or ("manual_bad_toggle_v136a" if status == "bad" else "bad_video_regenerated"),
            "at": at,
            "dt": _ava_project_review_dt_v136a(at),
        }

    raw_status = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()

    clear_token = str(
        scene.get("video_review_clear_token_v132y")
        or scene.get("videoReviewClearTokenV132Y")
        or scene.get("video_review_clear_token_v136a")
        or scene.get("videoReviewClearTokenV136A")
        or ""
    ).strip()
    accept_token = str(scene.get("video_review_accept_token_v132z") or scene.get("videoReviewAcceptTokenV132Z") or "").strip()
    clear_reason = str(scene.get("video_review_clear_reason") or scene.get("videoReviewClearReason") or "").strip()
    explicit_clear = bool(
        raw_status in {"accepted", "accept", "cleared", "clear", "ok", "good", "хорошее", "принято"}
        or cleared_at
        or accepted_at
        or clear_token
        or accept_token
        or clear_reason
        or reason in {"manual_review_clear_v136a", "manual_bad_clear_v136a", "manual_needs_review_clear_v136a"}
        or reason.startswith("manual_review_clear")
        or reason.startswith("manual_bad_clear")
        or reason.startswith("manual_needs_review")
        or reason.startswith("manual_bad_accept")
    )

    if explicit_clear:
        at = cleared_at or accepted_at or updated_at or str(scene.get("updatedAt") or scene.get("updated_at") or "").strip() or now_iso()
        return {
            "kind": "clear",
            "status": "",
            "reason": clear_reason or reason or "manual_review_clear_v136a",
            "at": at,
            "dt": _ava_project_review_dt_v136a(at),
        }

    return None


def _ava_project_clear_review_direct_fields_v136a(scene, event=None):
    if not isinstance(scene, dict):
        return
    event = event or {}
    at = str(event.get("at") or "").strip() or now_iso()
    reason = str(event.get("reason") or "manual_review_clear_v136a").strip()

    for key in (
        "video_review_status", "videoReviewStatus",
        "review_status", "reviewStatus",
        "video_review_regenerate_reason", "videoReviewRegenerateReason",
    ):
        scene[key] = ""
    scene["video_review_reason"] = ""
    scene["videoReviewReason"] = ""
    scene["needs_review"] = False
    scene["needsReview"] = False
    scene["video_review_regenerate_from_bad"] = False
    scene["videoReviewRegenerateFromBad"] = False
    scene["bad_video_review"] = False
    scene["badVideoReview"] = False
    scene["video_review_bad"] = False
    scene["videoReviewBad"] = False

    scene["video_review_clear_reason"] = reason
    scene["videoReviewClearReason"] = reason
    scene["video_review_cleared_at"] = at
    scene["videoReviewClearedAt"] = at
    scene["video_review_accepted_at"] = ""
    scene["videoReviewAcceptedAt"] = ""
    scene["video_review_accept_token_v132z"] = ""
    scene["videoReviewAcceptTokenV132Z"] = ""
    scene["video_review_clear_token_v132y"] = scene.get("video_review_clear_token_v132y") or scene.get("videoReviewClearTokenV132Y") or f"review_clear_v136a_{at}"
    scene["videoReviewClearTokenV132Y"] = scene["video_review_clear_token_v132y"]
    scene["project_review_direct_state_v136a"] = True
    scene["projectReviewDirectStateV136A"] = True


def _ava_project_apply_review_event_direct_v136a(scene, event):
    if not isinstance(scene, dict) or not isinstance(event, dict):
        return False

    kind = str(event.get("kind") or "").strip().lower()
    status = str(event.get("status") or "").strip().lower()
    at = str(event.get("at") or "").strip() or now_iso()
    reason = str(event.get("reason") or "").strip()

    if kind == "clear":
        _ava_project_clear_review_direct_fields_v136a(scene, event)
        return True

    if status not in {"bad", "needs_review"}:
        return False

    scene["video_review_status"] = status
    scene["videoReviewStatus"] = status
    scene["review_status"] = status
    scene["reviewStatus"] = status
    scene["video_review_updated_at"] = at
    scene["videoReviewUpdatedAt"] = at
    scene["video_review_reason"] = reason or ("manual_bad_toggle_v136a" if status == "bad" else "bad_video_regenerated")
    scene["videoReviewReason"] = scene["video_review_reason"]
    scene["video_review_clear_reason"] = ""
    scene["videoReviewClearReason"] = ""
    scene["video_review_cleared_at"] = ""
    scene["videoReviewClearedAt"] = ""
    scene["video_review_accepted_at"] = ""
    scene["videoReviewAcceptedAt"] = ""
    scene["video_review_accept_token_v132z"] = ""
    scene["videoReviewAcceptTokenV132Z"] = ""
    scene["video_review_clear_token_v132y"] = ""
    scene["videoReviewClearTokenV132Y"] = ""

    if status == "bad":
        scene["needs_review"] = False
        scene["needsReview"] = False
        scene["video_review_regenerate_from_bad"] = True
        scene["videoReviewRegenerateFromBad"] = True
        scene["video_review_regenerate_reason"] = "manual_bad_review_v136a"
        scene["videoReviewRegenerateReason"] = "manual_bad_review_v136a"
        scene["bad_video_review"] = True
        scene["badVideoReview"] = True
        scene["video_review_bad"] = True
        scene["videoReviewBad"] = True
    else:
        scene["needs_review"] = True
        scene["needsReview"] = True
        scene["video_review_regenerate_from_bad"] = False
        scene["videoReviewRegenerateFromBad"] = False
        scene["video_review_regenerate_reason"] = ""
        scene["videoReviewRegenerateReason"] = ""
        scene["bad_video_review"] = False
        scene["badVideoReview"] = False
        scene["video_review_bad"] = False
        scene["videoReviewBad"] = False
        # AVA_PROJECT_REVIEW_BAD_ALIASES_CLEAR_V203C
        scene["bad_video"] = False
        scene["badVideo"] = False
        scene["video_bad"] = False
        scene["videoBad"] = False
        scene["is_bad_video"] = False
        scene["isBadVideo"] = False

    scene["project_review_direct_state_v136a"] = True
    scene["projectReviewDirectStateV136A"] = True
    return True


def _ava_project_scene_id_direct_v136a(scene, index=0):
    if "_ava_board_scene_id_v131q2" in globals():
        try:
            return _ava_board_scene_id_v131q2(scene, index)
        except Exception:
            pass
    if "_ava_project_scene_id_final_v134r" in globals():
        try:
            return _ava_project_scene_id_final_v134r(scene, index)
        except Exception:
            pass
    if not isinstance(scene, dict):
        return f"scene_{index + 1}"
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}")


def _ava_project_scenes_direct_v136a(data):
    if "_ava_board_scenes_v131q2" in globals():
        try:
            return _ava_board_scenes_v131q2(data)
        except Exception:
            pass
    if "_ava_project_scenes_final_v134r" in globals():
        try:
            return _ava_project_scenes_final_v134r(data)
        except Exception:
            pass
    if isinstance(data, dict) and isinstance(data.get("scenes"), list):
        return data.get("scenes") or []
    return []


def _ava_project_apply_direct_review_state_v136a(source_data, current_data, final_data):
    if not isinstance(final_data, dict):
        return final_data, 0
    if not isinstance(source_data, dict):
        source_data = {}
    if not isinstance(current_data, dict):
        current_data = {}

    source_by_id = {
        _ava_project_scene_id_direct_v136a(scene, index): scene
        for index, scene in enumerate(_ava_project_scenes_direct_v136a(source_data))
        if isinstance(scene, dict)
    }
    current_by_id = {
        _ava_project_scene_id_direct_v136a(scene, index): scene
        for index, scene in enumerate(_ava_project_scenes_direct_v136a(current_data))
        if isinstance(scene, dict)
    }

    if not source_by_id and not current_by_id:
        return final_data, 0

    next_data = copy.deepcopy(final_data)
    scenes = _ava_project_scenes_direct_v136a(next_data)
    applied = []

    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue

        scene_id = _ava_project_scene_id_direct_v136a(scene, index)
        source_event = _ava_project_review_event_direct_v136a(source_by_id.get(scene_id))
        current_event = _ava_project_review_event_direct_v136a(current_by_id.get(scene_id))

        if not source_event and not current_event:
            continue

        if source_event and not current_event:
            winner = source_event
            winner_source = "incoming"
        elif source_event and current_event:
            source_dt = source_event.get("dt")
            current_dt = current_event.get("dt")
            if source_dt is None or current_dt is None:
                source_at = str(source_event.get("at") or "")
                current_at = str(current_event.get("at") or "")
                source_wins = source_at >= current_at
            else:
                source_wins = source_dt >= current_dt
            winner = source_event if source_wins else current_event
            winner_source = "incoming" if source_wins else "current"
        else:
            winner = current_event
            winner_source = "current"

        before = _ava_project_review_status_direct_v136a(scene)
        if _ava_project_apply_review_event_direct_v136a(scene, winner):
            after = _ava_project_review_status_direct_v136a(scene)
            applied.append({
                "scene_id": scene_id,
                "from": before,
                "to": after,
                "kind": winner.get("kind"),
                "at": winner.get("at"),
                "source": winner_source,
                "reason": winner.get("reason"),
            })

    if applied:
        next_data["scenes"] = scenes
        print("[PROJECT BOARD DIRECT REVIEW STATE V136A]", {
            "applied": applied,
        }, flush=True)
        return next_data, len(applied)

    return final_data, 0




# AVA_PROJECT_REVIEW_EVENT_AUTHORITY_V136D
# Final Board review-state authority. The newest explicit mark/clear event wins.
def _ava_project_review_event_dt_v136d(value):
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _ava_project_review_status_v136d(scene) -> str:
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


def _ava_project_review_event_v136d(scene):
    if not isinstance(scene, dict):
        return None

    status = _ava_project_review_status_v136d(scene)
    reason = str(
        scene.get("video_review_reason")
        or scene.get("videoReviewReason")
        or scene.get("video_review_clear_reason")
        or scene.get("videoReviewClearReason")
        or ""
    ).strip()

    updated_at = str(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or "").strip()
    cleared_at = str(scene.get("video_review_cleared_at") or scene.get("videoReviewClearedAt") or "").strip()
    accepted_at = str(scene.get("video_review_accepted_at") or scene.get("videoReviewAcceptedAt") or "").strip()
    clear_token = str(
        scene.get("video_review_clear_token_v132y")
        or scene.get("videoReviewClearTokenV132Y")
        or scene.get("video_review_clear_token_v136d")
        or scene.get("videoReviewClearTokenV136D")
        or ""
    ).strip()
    accept_token = str(scene.get("video_review_accept_token_v132z") or scene.get("videoReviewAcceptTokenV132Z") or "").strip()
    clear_reason = str(scene.get("video_review_clear_reason") or scene.get("videoReviewClearReason") or "").strip()
    raw_status = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()

    if status in {"bad", "needs_review"}:
        at = updated_at or cleared_at or accepted_at or str(scene.get("updatedAt") or scene.get("updated_at") or "").strip()
        return {
            "kind": "mark",
            "status": status,
            "reason": reason or ("manual_bad_toggle_v136d" if status == "bad" else "needs_review_v136d"),
            "at": at,
            "dt": _ava_project_review_event_dt_v136d(at),
        }

    explicit_clear = bool(
        raw_status in {"accepted", "accept", "cleared", "clear", "ok", "good", "хорошее", "принято"}
        or cleared_at
        or accepted_at
        or clear_token
        or accept_token
        or clear_reason
        or reason in {"manual_review_clear_v136a", "manual_review_clear_v136d", "manual_bad_clear_v136d"}
        or reason.startswith("manual_review_clear")
        or reason.startswith("manual_bad_accept")
        or reason.startswith("manual_bad_clear")
        or reason.startswith("manual_needs_review")
    )
    if explicit_clear:
        at = cleared_at or accepted_at or updated_at or str(scene.get("updatedAt") or scene.get("updated_at") or "").strip()
        return {
            "kind": "clear",
            "status": "",
            "reason": clear_reason or reason or "manual_review_clear_v136d",
            "at": at,
            "dt": _ava_project_review_event_dt_v136d(at),
        }

    return None


def _ava_project_scene_id_v136d(scene, index=0):
    if "_ava_board_scene_id_v131q2" in globals():
        try:
            return _ava_board_scene_id_v131q2(scene, index)
        except Exception:
            pass
    if not isinstance(scene, dict):
        return f"scene_{index + 1}"
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}")


def _ava_project_scenes_v136d(data):
    if "_ava_board_scenes_v131q2" in globals():
        try:
            return _ava_board_scenes_v131q2(data)
        except Exception:
            pass
    if isinstance(data, dict) and isinstance(data.get("scenes"), list):
        return data.get("scenes") or []
    return []


def _ava_project_apply_review_event_v136d(scene, event):
    # AVA_PROJECT_REVIEW_EVENT_IDEMPOTENT_V200B:
    # The same clear/mark event can be present in incoming and current snapshots.
    # Older logic rewrote the same fields on every autosave and returned True,
    # causing a save loop with repeated "source_image_changed_v133b" clear events.
    if not isinstance(scene, dict) or not isinstance(event, dict):
        return False

    kind = str(event.get("kind") or "").strip().lower()
    status = str(event.get("status") or "").strip().lower()
    at = str(event.get("at") or "").strip() or now_iso()
    reason = str(event.get("reason") or "").strip()

    if kind == "clear":
        target_reason = reason or "manual_review_clear_v136d"
        target_token = scene.get("video_review_clear_token_v132y") or scene.get("videoReviewClearTokenV132Y") or f"review_clear_v136d_{at}"
        desired = {
            "video_review_status": "",
            "videoReviewStatus": "",
            "review_status": "",
            "reviewStatus": "",
            "video_review_regenerate_reason": "",
            "videoReviewRegenerateReason": "",
            "video_review_reason": "",
            "videoReviewReason": "",
            "video_review_regenerate_from_bad": False,
            "videoReviewRegenerateFromBad": False,
            "needs_review": False,
            "needsReview": False,
            "bad_video_review": False,
            "badVideoReview": False,
            "video_review_bad": False,
            "videoReviewBad": False,
            "video_review_clear_reason": target_reason,
            "videoReviewClearReason": target_reason,
            "video_review_cleared_at": at,
            "videoReviewClearedAt": at,
            "video_review_accepted_at": "",
            "videoReviewAcceptedAt": "",
            "video_review_accept_token_v132z": "",
            "videoReviewAcceptTokenV132Z": "",
            "video_review_clear_token_v132y": target_token,
            "videoReviewClearTokenV132Y": target_token,
            "project_review_event_authority_v136d": True,
            "projectReviewEventAuthorityV136D": True,
        }
        if all(scene.get(key) == value for key, value in desired.items()):
            return False
        scene.update(desired)
        return True

    if status not in {"bad", "needs_review"}:
        return False

    target_reason = reason or ("manual_bad_toggle_v136d" if status == "bad" else "needs_review_v136d")
    desired = {
        "video_review_status": status,
        "videoReviewStatus": status,
        "review_status": status,
        "reviewStatus": status,
        "video_review_reason": target_reason,
        "videoReviewReason": target_reason,
        "video_review_updated_at": at,
        "videoReviewUpdatedAt": at,
        "video_review_clear_reason": "",
        "videoReviewClearReason": "",
        "video_review_cleared_at": "",
        "videoReviewClearedAt": "",
        "video_review_accepted_at": "",
        "videoReviewAcceptedAt": "",
        "video_review_accept_token_v132z": "",
        "videoReviewAcceptTokenV132Z": "",
        "video_review_clear_token_v132y": "",
        "videoReviewClearTokenV132Y": "",
        "project_review_event_authority_v136d": True,
        "projectReviewEventAuthorityV136D": True,
    }
    if status == "bad":
        desired.update({
            "video_review_regenerate_from_bad": True,
            "videoReviewRegenerateFromBad": True,
            "video_review_regenerate_reason": "manual_bad_review_v136d",
            "videoReviewRegenerateReason": "manual_bad_review_v136d",
            "bad_video_review": True,
            "badVideoReview": True,
            "video_review_bad": True,
            "videoReviewBad": True,
            "needs_review": False,
            "needsReview": False,
        })
    else:
        desired.update({
            "needs_review": True,
            "needsReview": True,
            "video_review_regenerate_from_bad": False,
            "videoReviewRegenerateFromBad": False,
            "video_review_regenerate_reason": "",
            "videoReviewRegenerateReason": "",
            "bad_video_review": False,
            "badVideoReview": False,
            "video_review_bad": False,
            "videoReviewBad": False,
        })

    if all(scene.get(key) == value for key, value in desired.items()):
        return False
    scene.update(desired)
    return True

def _ava_project_apply_review_event_authority_v136d(source_data, current_data, final_data):
    if not isinstance(final_data, dict):
        return final_data, 0
    if not isinstance(source_data, dict):
        source_data = {}
    if not isinstance(current_data, dict):
        current_data = {}

    source_by_id = {
        _ava_project_scene_id_v136d(scene, index): scene
        for index, scene in enumerate(_ava_project_scenes_v136d(source_data))
        if isinstance(scene, dict)
    }
    current_by_id = {
        _ava_project_scene_id_v136d(scene, index): scene
        for index, scene in enumerate(_ava_project_scenes_v136d(current_data))
        if isinstance(scene, dict)
    }

    if not source_by_id and not current_by_id:
        return final_data, 0

    next_data = copy.deepcopy(final_data)
    scenes = _ava_project_scenes_v136d(next_data)
    applied = []

    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_scene_id_v136d(scene, index)
        source_event = _ava_project_review_event_v136d(source_by_id.get(scene_id))
        current_event = _ava_project_review_event_v136d(current_by_id.get(scene_id))

        if not source_event and not current_event:
            continue

        if source_event and not current_event:
            winner, winner_source = source_event, "incoming"
        elif source_event and current_event:
            # AVA_PROJECT_REVIEW_REGEN_NEEDS_REVIEW_WINS_V200L:
            # A server-batch bad-video regeneration writes needs_review/posmotri. A late autosave
            # or old Telegram callback can still carry the previous bad mark. Do not let that
            # stale bad event override a current regenerated needs_review result.
            current_is_regenerated_needs_review_v200l = (
                str(current_event.get("status") or "").strip().lower() == "needs_review" and
                "bad_video_regenerated" in str(current_event.get("reason") or "").lower()
            )
            source_is_bad_v200l = str(source_event.get("status") or "").strip().lower() == "bad"
            source_dt = source_event.get("dt")
            current_dt = current_event.get("dt")
            source_reason_v213l = str(source_event.get("reason") or "").strip().lower()
            source_is_manual_bad_v213l = (
                source_reason_v213l.startswith("manual_")
                or "manual_bad" in source_reason_v213l
                or "toggle" in source_reason_v213l
            )
            if current_is_regenerated_needs_review_v200l and source_is_bad_v200l and not source_is_manual_bad_v213l:
                # AVA_PROJECT_REVIEW_MANUAL_STATUS_AUTHORITY_V213L:
                # Keep the old protection only for stale non-manual bad events.
                # A fresh user click "плохое" after watching "посмотри" must be allowed to win.
                source_wins = False
            elif current_is_regenerated_needs_review_v200l and source_is_bad_v200l and source_is_manual_bad_v213l:
                if source_dt is not None and current_dt is not None:
                    source_wins = source_dt >= current_dt
                else:
                    source_wins = True
            else:
                if source_dt is not None and current_dt is not None:
                    source_wins = source_dt >= current_dt
                else:
                    source_wins = str(source_event.get("at") or "") >= str(current_event.get("at") or "")
            winner = source_event if source_wins else current_event
            winner_source = "incoming" if source_wins else "current"
        else:
            winner, winner_source = current_event, "current"

        before = _ava_project_review_status_v136d(scene)
        if _ava_project_apply_review_event_v136d(scene, winner):
            after = _ava_project_review_status_v136d(scene)
            applied.append({
                "scene_id": scene_id,
                "from": before,
                "to": after,
                "kind": winner.get("kind"),
                "source": winner_source,
                "at": winner.get("at"),
                "reason": winner.get("reason"),
            })

    if applied:
        next_data["scenes"] = scenes
        print("[PROJECT BOARD REVIEW EVENT AUTHORITY V136D]", {"applied": applied}, flush=True)
        return next_data, len(applied)

    return final_data, 0




# AVA_PROJECT_SERVER_REVIEW_EVENT_MEMORY_V136E
# Server-side last-review-event memory per board scene.
# This blocks one late stale autosave after F5 from reviving an old "bad" mark
# after the user has already cleared it.
def _ava_project_review_memory_parse_dt_v136e(value):
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _ava_project_review_memory_event_v136e(scene):
    if not isinstance(scene, dict):
        return None

    if "_ava_project_review_event_v136d" in globals():
        try:
            event = _ava_project_review_event_v136d(scene)
            if event:
                return {
                    "kind": str(event.get("kind") or "").strip(),
                    "status": str(event.get("status") or "").strip(),
                    "reason": str(event.get("reason") or "").strip(),
                    "at": str(event.get("at") or "").strip(),
                    "dt": event.get("dt") or _ava_project_review_memory_parse_dt_v136e(event.get("at")),
                }
        except Exception:
            pass

    status = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()

    reason = str(
        scene.get("video_review_reason")
        or scene.get("videoReviewReason")
        or scene.get("video_review_clear_reason")
        or scene.get("videoReviewClearReason")
        or ""
    ).strip()

    updated_at = str(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or "").strip()
    cleared_at = str(scene.get("video_review_cleared_at") or scene.get("videoReviewClearedAt") or "").strip()
    accepted_at = str(scene.get("video_review_accepted_at") or scene.get("videoReviewAcceptedAt") or "").strip()
    clear_token = str(
        scene.get("video_review_clear_token_v136d")
        or scene.get("videoReviewClearTokenV136D")
        or scene.get("video_review_clear_token_v132y")
        or scene.get("videoReviewClearTokenV132Y")
        or ""
    ).strip()
    clear_reason = str(scene.get("video_review_clear_reason") or scene.get("videoReviewClearReason") or "").strip()

    if status in {"bad", "needs_review"}:
        at = updated_at or cleared_at or accepted_at
        return {"kind": "mark", "status": status, "reason": reason, "at": at, "dt": _ava_project_review_memory_parse_dt_v136e(at)}

    if cleared_at or accepted_at or clear_token or clear_reason or reason.startswith("manual_review_clear") or reason.startswith("manual_bad_clear") or reason.startswith("manual_bad_accept"):
        at = cleared_at or accepted_at or updated_at
        return {"kind": "clear", "status": "", "reason": clear_reason or reason or "manual_review_clear_v136e", "at": at, "dt": _ava_project_review_memory_parse_dt_v136e(at)}

    return None


def _ava_project_review_memory_better_v136e(left, right):
    if not left:
        return right
    if not right:
        return left
    left_dt = left.get("dt") or _ava_project_review_memory_parse_dt_v136e(left.get("at"))
    right_dt = right.get("dt") or _ava_project_review_memory_parse_dt_v136e(right.get("at"))
    if left_dt is not None and right_dt is not None:
        return right if right_dt >= left_dt else left
    left_at = str(left.get("at") or "")
    right_at = str(right.get("at") or "")
    if right_at and not left_at:
        return right
    if left_at and not right_at:
        return left
    return right if right_at >= left_at else left


def _ava_project_review_memory_scene_id_v136e(scene, index=0):
    if "_ava_project_scene_id_v136d" in globals():
        try:
            return _ava_project_scene_id_v136d(scene, index)
        except Exception:
            pass
    if "_ava_board_scene_id_v131q2" in globals():
        try:
            return _ava_board_scene_id_v131q2(scene, index)
        except Exception:
            pass
    if not isinstance(scene, dict):
        return f"scene_{index + 1}"
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}")


def _ava_project_review_memory_scenes_v136e(data):
    if "_ava_project_scenes_v136d" in globals():
        try:
            return _ava_project_scenes_v136d(data)
        except Exception:
            pass
    if "_ava_board_scenes_v131q2" in globals():
        try:
            return _ava_board_scenes_v131q2(data)
        except Exception:
            pass
    if isinstance(data, dict) and isinstance(data.get("scenes"), list):
        return data.get("scenes") or []
    return []


def _ava_project_review_memory_root_v136e(data):
    if not isinstance(data, dict):
        return {}
    raw = data.get("board_review_event_memory_v136e") or data.get("boardReviewEventMemoryV136E") or {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    for scene_id, value in raw.items():
        if not isinstance(value, dict):
            continue
        at = str(value.get("at") or "").strip()
        event = {
            "kind": str(value.get("kind") or "").strip(),
            "status": str(value.get("status") or "").strip(),
            "reason": str(value.get("reason") or "").strip(),
            "at": at,
            "dt": _ava_project_review_memory_parse_dt_v136e(at),
        }
        if event["kind"] in {"mark", "clear"}:
            out[str(scene_id)] = event
    return out


def _ava_project_review_memory_apply_event_v136e(scene, event):
    if not isinstance(scene, dict) or not isinstance(event, dict):
        return False
    if "_ava_project_apply_review_event_v136d" in globals():
        try:
            return bool(_ava_project_apply_review_event_v136d(scene, event))
        except Exception:
            pass

    kind = str(event.get("kind") or "").strip()
    status = str(event.get("status") or "").strip()
    at = str(event.get("at") or "").strip() or now_iso()
    reason = str(event.get("reason") or "").strip()

    if kind == "clear":
        for key in ("video_review_status", "videoReviewStatus", "review_status", "reviewStatus"):
            scene[key] = ""
        scene["video_review_reason"] = ""
        scene["videoReviewReason"] = ""
        scene["video_review_clear_reason"] = reason or "manual_review_clear_v136e"
        scene["videoReviewClearReason"] = scene["video_review_clear_reason"]
        scene["video_review_cleared_at"] = at
        scene["videoReviewClearedAt"] = at
        scene["bad_video_review"] = False
        scene["badVideoReview"] = False
        scene["video_review_bad"] = False
        scene["videoReviewBad"] = False
        scene["video_review_regenerate_from_bad"] = False
        scene["videoReviewRegenerateFromBad"] = False
        return True

    if kind == "mark" and status in {"bad", "needs_review"}:
        scene["video_review_status"] = status
        scene["videoReviewStatus"] = status
        scene["review_status"] = status
        scene["reviewStatus"] = status
        scene["video_review_reason"] = reason or "manual_bad_toggle_v136e"
        scene["videoReviewReason"] = scene["video_review_reason"]
        scene["video_review_updated_at"] = at
        scene["videoReviewUpdatedAt"] = at
        scene["video_review_clear_reason"] = ""
        scene["videoReviewClearReason"] = ""
        scene["video_review_cleared_at"] = ""
        scene["videoReviewClearedAt"] = ""
        if status == "bad":
            scene["bad_video_review"] = True
            scene["badVideoReview"] = True
            scene["video_review_bad"] = True
            scene["videoReviewBad"] = True
            # AVA_PROJECT_REVIEW_BAD_ALIASES_SET_V203C
            scene["bad_video"] = True
            scene["badVideo"] = True
            scene["video_bad"] = True
            scene["videoBad"] = True
            scene["is_bad_video"] = True
            scene["isBadVideo"] = True
            scene["video_review_regenerate_from_bad"] = True
            scene["videoReviewRegenerateFromBad"] = True
        return True

    return False


def _ava_project_apply_server_review_memory_v136e(source_data, current_data, final_data):
    if not isinstance(final_data, dict):
        return final_data, 0
    if not isinstance(source_data, dict):
        source_data = {}
    if not isinstance(current_data, dict):
        current_data = {}

    memory = _ava_project_review_memory_root_v136e(current_data)

    for index, scene in enumerate(_ava_project_review_memory_scenes_v136e(current_data)):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_review_memory_scene_id_v136e(scene, index)
        event = _ava_project_review_memory_event_v136e(scene)
        if event:
            memory[scene_id] = _ava_project_review_memory_better_v136e(memory.get(scene_id), event)

    for index, scene in enumerate(_ava_project_review_memory_scenes_v136e(source_data)):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_review_memory_scene_id_v136e(scene, index)
        event = _ava_project_review_memory_event_v136e(scene)
        if event:
            memory[scene_id] = _ava_project_review_memory_better_v136e(memory.get(scene_id), event)

    if not memory:
        return final_data, 0

    next_data = copy.deepcopy(final_data)
    scenes = _ava_project_review_memory_scenes_v136e(next_data)
    applied = []

    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_review_memory_scene_id_v136e(scene, index)
        event = memory.get(scene_id)
        if not event:
            continue
        # AVA_PROJECT_CLEAR_BEATS_STALE_BAD_MEMORY_V203C:
        # A newer UI clear or a new completed video clear must beat an older Telegram/server-memory bad mark.
        event_status_v203c = str(event.get("status") or "").strip().lower()
        if event_status_v203c == "bad":
            final_scene_event_v203c = _ava_project_review_memory_event_v136e(scene)
            if isinstance(final_scene_event_v203c, dict) and str(final_scene_event_v203c.get("kind") or "").strip().lower() == "clear":
                clear_dt_v203c = final_scene_event_v203c.get("dt") or _ava_project_review_memory_parse_dt_v136e(final_scene_event_v203c.get("at"))
                bad_dt_v203c = event.get("dt") or _ava_project_review_memory_parse_dt_v136e(event.get("at"))
                clear_at_v203c = str(final_scene_event_v203c.get("at") or "")
                bad_at_v203c = str(event.get("at") or "")
                clear_wins_v203c = False
                if clear_dt_v203c is not None and bad_dt_v203c is not None:
                    clear_wins_v203c = clear_dt_v203c >= bad_dt_v203c
                elif clear_at_v203c and bad_at_v203c:
                    clear_wins_v203c = clear_at_v203c >= bad_at_v203c
                else:
                    clear_wins_v203c = True
                if clear_wins_v203c:
                    memory[scene_id] = final_scene_event_v203c
                    continue

        before = _ava_project_review_status_v136d(scene) if "_ava_project_review_status_v136d" in globals() else ""
        # AVA_PROJECT_REGEN_NEEDS_REVIEW_BLOCKS_BAD_MEMORY_V200M:
        # A freshly regenerated bad video is intentionally changed to needs_review
        # (orange "посмотри"). The long-lived server review memory can still contain
        # an older manual/Telegram bad mark. Do not reapply that stale bad memory
        # over the regenerated result.
        scene_status_v200m = str(
            scene.get("video_review_status") or scene.get("videoReviewStatus") or scene.get("review_status") or scene.get("reviewStatus") or ""
        ).strip().lower()
        scene_reason_v200m = str(scene.get("video_review_reason") or scene.get("videoReviewReason") or "").strip().lower()
        event_status_v200m = str(event.get("status") or "").strip().lower()
        event_reason_v200m = str(event.get("reason") or "").strip().lower()
        if (
            scene_status_v200m == "needs_review" and
            "bad_video_regenerated" in scene_reason_v200m and
            event_status_v200m == "bad" and
            "bad_video_regenerated" not in event_reason_v200m
        ):
            # AVA_PROJECT_REVIEW_MANUAL_STATUS_AUTHORITY_V213L:
            # Do not replay an older non-manual bad mark over a regenerated "посмотри" result,
            # but do allow a newer manual user click "плохое" to become the new authority.
            scene_dt_v213l = _ava_project_review_memory_parse_dt_v136e(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or "")
            event_dt_v213l = event.get("dt") or _ava_project_review_memory_parse_dt_v136e(event.get("at"))
            event_is_manual_bad_v213l = (
                event_reason_v200m.startswith("manual_")
                or event_reason_v200m.startswith("telegram_review_")
                or "telegram_bad_review" in event_reason_v200m
                or "manual_bad" in event_reason_v200m
                or "toggle" in event_reason_v200m
            )
            manual_bad_is_newer_v213l = bool(event_is_manual_bad_v213l and (
                (event_dt_v213l is not None and scene_dt_v213l is not None and event_dt_v213l >= scene_dt_v213l)
                or (event_dt_v213l is not None and scene_dt_v213l is None)
                or (str(event.get("at") or "") and str(event.get("at") or "") >= str(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or ""))
            ))
            if not manual_bad_is_newer_v213l:
                memory[scene_id] = {
                    "kind": "mark",
                    "status": "needs_review",
                    "reason": scene.get("video_review_reason") or scene.get("videoReviewReason") or "bad_video_regenerated",
                    "at": scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or now_iso(),
                    "dt": _ava_project_review_memory_parse_dt_v136e(scene.get("video_review_updated_at") or scene.get("videoReviewUpdatedAt") or ""),
                }
                continue
        if _ava_project_review_memory_apply_event_v136e(scene, event):
            after = _ava_project_review_status_v136d(scene) if "_ava_project_review_status_v136d" in globals() else str(event.get("status") or "")
            applied.append({
                "scene_id": scene_id,
                "from": before,
                "to": after,
                "kind": event.get("kind"),
                "at": event.get("at"),
                "reason": event.get("reason"),
            })

    compact_memory = {}
    for scene_id, event in memory.items():
        compact_memory[scene_id] = {
            "kind": str(event.get("kind") or ""),
            "status": str(event.get("status") or ""),
            "reason": str(event.get("reason") or ""),
            "at": str(event.get("at") or ""),
        }

    next_data["board_review_event_memory_v136e"] = compact_memory
    next_data["boardReviewEventMemoryV136E"] = compact_memory

    if applied:
        next_data["scenes"] = scenes
        print("[PROJECT BOARD SERVER REVIEW MEMORY V136E]", {"applied": applied}, flush=True)
        return next_data, len(applied)

    return next_data, 0


# AVA_PROJECT_TELEGRAM_REVIEW_NOTE_MEMORY_V137C
# Preserve Telegram review comments against stale Board autosaves.
def _ava_project_telegram_note_parse_dt_v137c(value):
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except Exception:
        return None


def _ava_project_telegram_note_scene_id_v137c(scene, index=0):
    if "_ava_project_review_memory_scene_id_v136e" in globals():
        try:
            return _ava_project_review_memory_scene_id_v136e(scene, index)
        except Exception:
            pass
    if not isinstance(scene, dict):
        return f"scene_{index + 1}"
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}")


def _ava_project_telegram_note_scenes_v137c(data):
    if "_ava_project_review_memory_scenes_v136e" in globals():
        try:
            return _ava_project_review_memory_scenes_v136e(data)
        except Exception:
            pass
    if isinstance(data, dict) and isinstance(data.get("scenes"), list):
        return data.get("scenes") or []
    return []


def _ava_project_telegram_note_clean_entry_v137c(scene_id, value):
    if not isinstance(value, dict):
        return None
    scene_id = str(scene_id or value.get("scene_id") or value.get("sceneId") or "").strip()
    if not scene_id:
        return None
    at = str(value.get("updated_at") or value.get("updatedAt") or value.get("at") or "").strip()
    status_value = str(value.get("status") or "").strip().lower()
    comment = str(value.get("comment") or "").strip()
    entry = {
        "scene_id": scene_id,
        "sceneId": scene_id,
        "review_id": str(value.get("review_id") or value.get("reviewId") or ""),
        "reviewId": str(value.get("review_id") or value.get("reviewId") or ""),
        "project_id": str(value.get("project_id") or value.get("projectId") or ""),
        "projectId": str(value.get("project_id") or value.get("projectId") or ""),
        "job_id": str(value.get("job_id") or value.get("jobId") or ""),
        "jobId": str(value.get("job_id") or value.get("jobId") or ""),
        "asset_id": str(value.get("asset_id") or value.get("assetId") or ""),
        "assetId": str(value.get("asset_id") or value.get("assetId") or ""),
        "status": status_value,
        "reason": str(value.get("reason") or ""),
        "comment": comment if status_value == "bad" else "",
        "note_block": str(value.get("note_block") or value.get("noteBlock") or ""),
        "noteBlock": str(value.get("note_block") or value.get("noteBlock") or ""),
        "at": at,
        "updated_at": at,
        "updatedAt": at,
        "dt": _ava_project_telegram_note_parse_dt_v137c(at),
    }
    return entry


def _ava_project_telegram_note_root_v137c(data):
    if not isinstance(data, dict):
        return {}
    raw = data.get("board_telegram_review_note_memory_v137c") or data.get("boardTelegramReviewNoteMemoryV137C") or {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    for scene_id, value in raw.items():
        entry = _ava_project_telegram_note_clean_entry_v137c(scene_id, value)
        if entry:
            out[str(entry.get("scene_id") or scene_id)] = entry
    return out


def _ava_project_telegram_note_better_v137c(left, right):
    if not left:
        return right
    if not right:
        return left
    left_dt = left.get("dt") or _ava_project_telegram_note_parse_dt_v137c(left.get("at"))
    right_dt = right.get("dt") or _ava_project_telegram_note_parse_dt_v137c(right.get("at"))
    if left_dt is not None and right_dt is not None:
        return right if right_dt >= left_dt else left
    left_at = str(left.get("at") or "")
    right_at = str(right.get("at") or "")
    if right_at and not left_at:
        return right
    if left_at and not right_at:
        return left
    return right if right_at >= left_at else left


def _ava_project_telegram_note_from_items_v137c(db, project_id):
    out = {}
    if not isinstance(db, dict):
        return out
    items = db.get("telegram_review_items") or {}
    if not isinstance(items, dict):
        return out
    for _review_id, item in items.items():
        if not isinstance(item, dict):
            continue
        item_project = str(item.get("project_id") or item.get("projectId") or "").strip()
        if item_project != str(project_id):
            continue
        scene_id = str(item.get("scene_id") or item.get("sceneId") or "").strip()
        if not scene_id:
            continue
        entry = _ava_project_telegram_note_clean_entry_v137c(scene_id, item)
        if not entry:
            continue
        out[scene_id] = _ava_project_telegram_note_better_v137c(out.get(scene_id), entry)
    return out


def _ava_project_telegram_note_block_v137c(entry):
    block = str(entry.get("note_block") or entry.get("noteBlock") or "").strip()
    if block:
        return block
    scene_id = str(entry.get("scene_id") or entry.get("sceneId") or "").strip()
    at = str(entry.get("at") or entry.get("updated_at") or entry.get("updatedAt") or now_iso()).strip() or now_iso()
    asset_id = str(entry.get("asset_id") or entry.get("assetId") or "").strip()
    job_id = str(entry.get("job_id") or entry.get("jobId") or "").strip()
    comment = str(entry.get("comment") or "").strip()
    return (
        "--- Telegram review ---\n"
        f"❌ Не OK · {at}\n"
        f"Сцена: {scene_id}\n"
        f"Видео: {asset_id or '-'}\n"
        f"Job: {job_id or '-'}\n"
        f"Комментарий: {comment}"
    )


def _ava_project_apply_telegram_review_note_memory_v137c(db, project_id, source_data, current_data, final_data):
    if not isinstance(final_data, dict):
        return final_data, 0
    source_data = source_data if isinstance(source_data, dict) else {}
    current_data = current_data if isinstance(current_data, dict) else {}

    memory = {}
    for data in (current_data, source_data, final_data):
        for scene_id, entry in _ava_project_telegram_note_root_v137c(data).items():
            memory[scene_id] = _ava_project_telegram_note_better_v137c(memory.get(scene_id), entry)
    for scene_id, entry in _ava_project_telegram_note_from_items_v137c(db, project_id).items():
        memory[scene_id] = _ava_project_telegram_note_better_v137c(memory.get(scene_id), entry)

    if not memory:
        return final_data, 0

    next_data = copy.deepcopy(final_data)
    scenes = _ava_project_telegram_note_scenes_v137c(next_data)
    current_by_id = {
        _ava_project_telegram_note_scene_id_v137c(scene, index): scene
        for index, scene in enumerate(_ava_project_telegram_note_scenes_v137c(current_data))
        if isinstance(scene, dict)
    }
    applied = []

    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_telegram_note_scene_id_v137c(scene, index)
        entry = memory.get(scene_id)
        if not entry:
            continue
        status_value = str(entry.get("status") or "").strip().lower()
        comment = str(entry.get("comment") or "").strip()
        scene["telegram_review_id"] = str(entry.get("review_id") or entry.get("reviewId") or "")
        scene["telegramReviewId"] = scene["telegram_review_id"]
        scene["telegram_review_comment"] = comment if status_value == "bad" else ""
        scene["telegramReviewComment"] = scene["telegram_review_comment"]
        scene["telegram_review_updated_at"] = str(entry.get("at") or entry.get("updated_at") or entry.get("updatedAt") or "")
        scene["telegramReviewUpdatedAt"] = scene["telegram_review_updated_at"]

        if status_value != "bad" or not comment:
            continue

        block = _ava_project_telegram_note_block_v137c(entry).strip()
        if not block:
            continue
        incoming_note = str(scene.get("note") or "")
        server_scene = current_by_id.get(scene_id) if isinstance(current_by_id, dict) else None
        server_note = str(server_scene.get("note") or "") if isinstance(server_scene, dict) else ""
        base_note = incoming_note
        if not base_note and server_note:
            base_note = server_note
        if block not in base_note and comment not in base_note:
            scene["note"] = (base_note.rstrip() + "\n\n" + block).strip()
            applied.append({"scene_id": scene_id, "comment": comment[:120], "at": entry.get("at")})
        elif base_note and base_note != incoming_note:
            scene["note"] = base_note

    compact_memory = {}
    for scene_id, entry in memory.items():
        compact = dict(entry)
        compact.pop("dt", None)
        compact_memory[scene_id] = compact
    next_data["board_telegram_review_note_memory_v137c"] = compact_memory
    next_data["boardTelegramReviewNoteMemoryV137C"] = compact_memory
    next_data["scenes"] = scenes

    if applied:
        print("[PROJECT BOARD TELEGRAM REVIEW NOTE MEMORY V137C]", {"applied": applied}, flush=True)
        return next_data, len(applied)
    return next_data, 0



# AVA_PROJECT_SNAPSHOT_NOOP_SKIP_WRITE_V200F: already covered by older patch; marker added for idempotency.
# AVA_PROJECT_SNAPSHOT_NOOP_SAVE_GUARD_V200B:
# Board autosave can POST the same snapshot again and again while background polling is active.
# Do not rewrite the whole JSON database if only volatile UI timestamps changed.
def _ava_project_snapshot_strip_volatile_v200b(value):
    volatile_keys = {
        "updatedAt", "updated_at", "lastSavedAt", "last_saved_at",
        "clientUpdatedAt", "client_updated_at", "lastAutoSaveAt", "last_auto_save_at",
    }
    if isinstance(value, dict):
        return {
            str(key): _ava_project_snapshot_strip_volatile_v200b(item)
            for key, item in value.items()
            if str(key) not in volatile_keys
        }
    if isinstance(value, list):
        return [_ava_project_snapshot_strip_volatile_v200b(item) for item in value]
    return value


def _ava_project_snapshot_noop_equal_v200b(current_data, incoming_data) -> bool:
    try:
        return _ava_project_snapshot_strip_volatile_v200b(current_data or {}) == _ava_project_snapshot_strip_volatile_v200b(incoming_data or {})
    except Exception:
        return False




def _ava_project_preserve_board_assembly_final_v200p(current_data: Any, incoming_data: Any) -> tuple[Any, int]:
    """AVA_ASSEMBLY_FINAL_F5_PRESERVE_V200P: don't let Board re-import wipe final Assembly MP4."""
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0

    final_keys = [
        "finalVideoUrl", "final_video_url", "finalUrl", "final_url",
        "assemblyUrl", "assembly_url", "outputUrl", "output_url",
        "resultUrl", "result_url", "downloadUrl", "download_url", "videoUrl", "video_url",
        "assemblyApiPath", "assembly_api_path", "finalVideoApiPath", "final_video_api_path",
        "resultVideoApiPath", "result_video_api_path", "outputApiPath", "output_api_path",
        "assemblyAssetId", "assembly_asset_id", "finalVideoAssetId", "final_video_asset_id",
        "assetId", "asset_id",
    ]
    current_has_final = any(bool(current_data.get(k)) for k in final_keys)
    incoming_has_final = any(bool(incoming_data.get(k)) for k in final_keys)
    if not current_has_final or incoming_has_final:
        return incoming_data, 0

    # Treat incoming as a stale Board->Assembly bootstrap if it has scenes/items but no final refs.
    merged = deepcopy(incoming_data)
    changed = 0
    for key in final_keys:
        value = current_data.get(key)
        if value and not merged.get(key):
            merged[key] = deepcopy(value)
            changed += 1

    # Preserve result metadata that helps UI display/open/download without requiring another register.
    meta_keys = [
        "assemblyResult", "assembly_result", "result", "finalResult", "final_result",
        "registeredAsset", "registered_asset", "assemblyAsset", "assembly_asset",
        "finalDirty", "updatedAt", "completedAt", "completed_at",
    ]
    for key in meta_keys:
        value = current_data.get(key)
        if value and not merged.get(key):
            merged[key] = deepcopy(value)
            changed += 1

    # The final MP4 still exists; do not mark dirty just because a restore save happened.
    if changed:
        merged["finalDirty"] = bool(current_data.get("finalDirty", False))
        merged["final_dirty"] = bool(current_data.get("final_dirty", merged["finalDirty"]))
        merged["assemblyFinalPreservedV200P"] = True
    return merged, changed


# AVA_VIDEO_NODE_HARD_CLEAR_SNAPSHOT_GUARD_V209B
# A Video Node manual clear must beat old in-flight autosaves/hydration restores.
# The clear stores a small tombstone snapshot. Later safe_merge saves whose updatedAt/importedAt
# is older than the clear are rejected, so the old source video/layout cannot resurrect.
def _ava_video_node_epoch_ms_v209b(value) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(float(value))
    except Exception:
        return 0


def _ava_video_node_clear_ms_v209b(data: dict) -> int:
    if not isinstance(data, dict):
        return 0
    return _ava_video_node_epoch_ms_v209b(
        data.get("videoNodeClearedAtMs")
        or data.get("video_node_cleared_at_ms")
        or data.get("hardClearedAtMs")
        or data.get("hard_cleared_at_ms")
    )


def _ava_video_node_data_ms_v209b(data: dict) -> int:
    if not isinstance(data, dict):
        return 0
    values = [
        data.get("updatedAt"),
        data.get("updated_at"),
        data.get("importedAt"),
        data.get("imported_at"),
        data.get("savedAt"),
        data.get("saved_at"),
    ]
    return max(_ava_video_node_epoch_ms_v209b(value) for value in values)


def _ava_video_node_has_materials_v209b(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    for key in ("matchSegments", "segments", "videoBlocks", "sourceVideos", "source_videos"):
        value = data.get(key)
        if isinstance(value, list) and len(value) > 0:
            return True
    return bool(
        data.get("sourceVideoUrl")
        or data.get("sourceVideoPath")
        or data.get("sourceVideoPathForAssembly")
        or data.get("uploadedSourceVideoPath")
        or data.get("importSignature")
    )


def _ava_video_node_clear_tombstone_v209b(client_version: str = "") -> dict:
    now_ms = int(time.time() * 1000)
    now_text = now_iso()
    return {
        "schema": "video_match_board_v2",
        "status": "cleared",
        "sourceVideo": {"filename": "", "duration_sec": 0},
        "source_video": {"filename": "", "duration_sec": 0},
        "sourceVideoUrl": "",
        "sourceVideos": [],
        "source_videos": [],
        "timingContext": {},
        "audioMap": {},
        "matchSegments": [],
        "videoBlocks": [],
        "selectedSegmentId": "",
        "selectedCandidateId": "",
        "selectedBlockId": "",
        "jsonInput": "",
        "jsonError": "",
        "video_node_hard_cleared_v209b": True,
        "videoNodeHardClearedV209B": True,
        "video_node_cleared_at": now_text,
        "videoNodeClearedAt": now_text,
        "video_node_cleared_at_ms": now_ms,
        "videoNodeClearedAtMs": now_ms,
        "clearClientVersion": str(client_version or ""),
        "updatedAt": now_ms,
    }


def _ava_video_node_should_block_stale_save_after_clear_v209b(current_data: dict, incoming_data: dict) -> bool:
    clear_ms = _ava_video_node_clear_ms_v209b(current_data)
    if not clear_ms:
        return False
    if not _ava_video_node_has_materials_v209b(incoming_data):
        return False
    incoming_ms = _ava_video_node_data_ms_v209b(incoming_data)
    # If incoming has no timestamp or it is not newer than the clear tombstone, it is an old
    # hydrate/autosave trying to resurrect previous Video Node state.
    return incoming_ms <= clear_ms


# AVA_PROJECT_BOARD_IMAGE_UPLOAD_BATCH_ISOLATION_V209K
# One-scene image upload must not mutate other Board scenes while a server batch is/was active.
# The browser can send an old ava-shell autosave after ltx_board has written a server-batch snapshot.
# This guard keeps lip-sync/source-cut contracts and consumes accidental image-change reset flags only
# for scenes that were not actually edited.
_BOARD_CONTRACT_KEYS_V209K = (
    "route", "planned_route", "plannedRoute", "workflow_key", "workflowKey", "workflow", "selectedWorkflow",
    "model_route", "modelRoute", "source_or_generated", "sourceOrGenerated",
    "contains_vocal", "containsVocal", "lip_sync_required", "lipSyncRequired", "lipsync_required", "lipsyncRequired",
    "is_lipsync", "isLipsync", "ia2v_audio_required", "ia2vAudioRequired", "audio_driven", "audioDriven",
    "audio_url", "audioUrl", "audio_api_path", "audioApiPath", "audio_asset_id", "audioAssetId",
    "audio_slice_url", "audioSliceUrl", "audio_slice_api_path", "audioSliceApiPath", "audio_slice_asset_id", "audioSliceAssetId",
    "audio_range", "audioRange", "audio_start_sec", "audioStartSec", "audio_end_sec", "audioEndSec",
    "audio_duration_sec", "audioDurationSec", "scene_audio_url", "sceneAudioUrl", "scene_audio_api_path", "sceneAudioApiPath",
    "voice_audio_url", "voiceAudioUrl", "voice_audio_api_path", "voiceAudioApiPath", "vocal_audio_url", "vocalAudioUrl",
    "source_phrase_ids", "sourcePhraseIds", "source_word_ids", "sourceWordIds",
    "video_node_role", "videoNodeRole", "skip_board_generation", "skipBoardGeneration",
    "fixedClipBinding", "fixed_clip_binding", "retimeSpec", "retime_spec", "assemblyMediaMode", "assembly_media_mode",
)

_BOARD_ROUTE_KEYS_V209K = (
    "route", "planned_route", "plannedRoute", "workflow_key", "workflowKey", "workflow", "selectedWorkflow",
    "model_route", "modelRoute", "source_or_generated", "sourceOrGenerated",
)

_BOARD_REVIEW_IMAGE_RESET_KEYS_V209K = (
    "video_review_reset_on_image_change_v133b", "videoReviewResetOnImageChangeV133B",
)

_BOARD_REVIEW_IMAGE_CLEAR_KEYS_V209K = (
    "video_review_clear_reason", "videoReviewClearReason",
    "video_review_cleared_at", "videoReviewClearedAt",
    "video_review_accept_token_v132z", "videoReviewAcceptTokenV132Z",
    "video_review_clear_token_v132y", "videoReviewClearTokenV132Y",
)

_BOARD_STRONG_IMAGE_KEYS_V209K = (
    "image_asset_id", "imageAssetId", "image_api_path", "imageApiPath", "image_url", "imageUrl",
    "photo_asset_id", "photoAssetId", "photo_api_path", "photoApiPath", "photo_url", "photoUrl",
    "first_image_asset_id", "firstImageAssetId", "first_image_api_path", "firstImageApiPath", "first_image_url", "firstImageUrl",
    "start_image_asset_id", "startImageAssetId", "start_image_api_path", "startImageApiPath", "start_image_url", "startImageUrl",
    "media_asset_id", "mediaAssetId", "media_api_path", "mediaApiPath", "media_url", "mediaUrl",
)

_BOARD_STRONG_IMAGE_OBJECT_KEYS_V209K = (
    "image", "photo", "media", "first_image", "firstImage", "start_image", "startImage", "source_image", "sourceImage",
)


def _ava_project_scene_id_v209k(scene, index=0):
    try:
        if "_ava_board_scene_id_v131q2" in globals():
            return _ava_board_scene_id_v131q2(scene, index)
    except Exception:
        pass
    if isinstance(scene, dict):
        return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}")
    return f"scene_{index + 1}"


def _ava_project_board_batch_guard_active_v209k(current_snapshot) -> bool:
    if not isinstance(current_snapshot, dict):
        return False
    client_version = str(current_snapshot.get("client_version") or "").strip()
    if client_version.startswith("board-server-video-batch"):
        return True
    data = current_snapshot.get("data") if isinstance(current_snapshot.get("data"), dict) else {}
    for key in ("video_batch", "videoBatch", "board_video_batch", "boardVideoBatch", "video_queue", "videoQueue"):
        value = data.get(key)
        if isinstance(value, dict) and value:
            status = str(value.get("status") or value.get("state") or value.get("batch_status") or "").strip().lower()
            if status in {"queued", "running", "processing", "finished", "finished_with_errors", "done", "complete", "completed"}:
                return True
            if value.get("batch_id") or value.get("batchId") or value.get("id"):
                return True
    return False


def _ava_project_scene_route_key_v209k(scene) -> str:
    if not isinstance(scene, dict):
        return ""
    raw = str(
        scene.get("route") or scene.get("planned_route") or scene.get("plannedRoute") or
        scene.get("model_route") or scene.get("modelRoute") or scene.get("workflow_key") or scene.get("workflowKey") or ""
    ).strip().lower()
    raw = raw.replace("-", "_").replace(" ", "_")
    if "source_cut" in raw or "video_cut" in raw or "нарез" in raw:
        return "source_cut"
    if "lip" in raw or "lipsync" in raw or "lip_sync" in raw:
        return "ia2v_lipsync"
    if raw in {"ia2v", "i2v", "i2v_sound", "i2v_text", "first_last", "first_last_sound", "ia2v_instrumental"}:
        return raw
    return raw


def _ava_project_scene_is_lipsync_v209k(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    route = _ava_project_scene_route_key_v209k(scene)
    return bool(
        route in {"ia2v", "ia2v_lipsync", "lipsync", "lip_sync"}
        or scene.get("lip_sync_required") is True or scene.get("lipSyncRequired") is True
        or scene.get("lipsync_required") is True or scene.get("lipsyncRequired") is True
        or scene.get("contains_vocal") is True or scene.get("containsVocal") is True
        or scene.get("is_lipsync") is True or scene.get("isLipsync") is True
        or scene.get("ia2v_audio_required") is True or scene.get("ia2vAudioRequired") is True
        or bool(scene.get("audio_slice_url") or scene.get("audioSliceUrl") or scene.get("audio_slice_api_path") or scene.get("audioSliceApiPath"))
    )


def _ava_project_scene_is_source_cut_v209k(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    route = _ava_project_scene_route_key_v209k(scene)
    role = str(scene.get("video_node_role") or scene.get("videoNodeRole") or "").strip().lower()

    # V209P: a scene with explicit lip-sync/audio contract must not be treated
    # as source_cut only because stale skip_board_generation/video_node_role leaked in.
    try:
        if _ava_project_scene_is_lipsync_v209k(scene):
            return False
    except Exception:
        pass

    return bool(
        route == "source_cut"
        or role in {"source_cut", "video_node_source_cut"}
        or scene.get("skip_board_generation") is True
        or scene.get("skipBoardGeneration") is True
    )


def _ava_project_selected_scene_id_v209k(data) -> str:
    if not isinstance(data, dict):
        return ""
    for key in (
        "selectedSceneId", "selected_scene_id", "activeSceneId", "active_scene_id", "currentSceneId", "current_scene_id",
        "editedSceneId", "edited_scene_id", "lastEditedSceneId", "last_edited_scene_id", "imageUploadSceneId", "image_upload_scene_id",
    ):
        value = str(data.get(key) or "").strip()
        if value:
            return value
    return ""


def _ava_project_strong_ref_value_v209k(value) -> set[str]:
    refs = set()
    if isinstance(value, str):
        raw = value.strip()
        if raw and raw.lower() not in {"null", "none", "undefined", "blob:"}:
            refs.add(raw)
    elif isinstance(value, (int, float)):
        # Do NOT include mutation epochs here. This strong-ref check is only durable media identity.
        pass
    elif isinstance(value, dict):
        for key in (
            "asset_id", "assetId", "image_asset_id", "imageAssetId", "photo_asset_id", "photoAssetId",
            "api_path", "apiPath", "image_api_path", "imageApiPath", "photo_api_path", "photoApiPath",
            "url", "src", "path", "image_url", "imageUrl", "photo_url", "photoUrl",
        ):
            refs.update(_ava_project_strong_ref_value_v209k(value.get(key)))
    return refs


def _ava_project_scene_strong_image_refs_v209k(scene) -> set[str]:
    refs = set()
    if not isinstance(scene, dict):
        return refs
    for key in _BOARD_STRONG_IMAGE_KEYS_V209K:
        refs.update(_ava_project_strong_ref_value_v209k(scene.get(key)))
    for key in _BOARD_STRONG_IMAGE_OBJECT_KEYS_V209K:
        refs.update(_ava_project_strong_ref_value_v209k(scene.get(key)))
    return refs


def _ava_project_scene_strong_image_changed_v209k(current_scene, incoming_scene) -> bool:
    current_refs = _ava_project_scene_strong_image_refs_v209k(current_scene)
    incoming_refs = _ava_project_scene_strong_image_refs_v209k(incoming_scene)
    return bool(current_refs and incoming_refs and current_refs.isdisjoint(incoming_refs))


def _ava_project_scene_has_reset_v209k(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    return any(scene.get(key) is True for key in _BOARD_REVIEW_IMAGE_RESET_KEYS_V209K)


def _ava_project_clear_accidental_review_reset_v209k(scene) -> bool:
    if not isinstance(scene, dict):
        return False
    changed = False
    for key in _BOARD_REVIEW_IMAGE_RESET_KEYS_V209K:
        if scene.get(key) is True:
            scene[key] = False
            changed = True
    reason = str(scene.get("video_review_clear_reason") or scene.get("videoReviewClearReason") or "").strip().lower()
    if reason == "source_image_changed_v133b":
        for key in _BOARD_REVIEW_IMAGE_CLEAR_KEYS_V209K:
            if scene.get(key) not in (None, "", False):
                scene[key] = ""
                changed = True
    return changed


def _ava_project_copy_contract_fields_v209k(current_scene, incoming_scene) -> int:
    if not isinstance(current_scene, dict) or not isinstance(incoming_scene, dict):
        return 0
    changed = 0
    current_is_lipsync = _ava_project_scene_is_lipsync_v209k(current_scene)
    current_is_source_cut = _ava_project_scene_is_source_cut_v209k(current_scene) and not current_is_lipsync
    if not current_is_lipsync and not current_is_source_cut:
        return 0

    incoming_route = _ava_project_scene_route_key_v209k(incoming_scene)
    current_route = _ava_project_scene_route_key_v209k(current_scene)
    route_downgraded = bool(
        (current_is_lipsync and incoming_route not in {"ia2v", "ia2v_lipsync", "lipsync", "lip_sync"})
        or (current_is_source_cut and incoming_route != "source_cut")
    )

    for key in _BOARD_CONTRACT_KEYS_V209K:
        if key not in current_scene:
            continue
        current_value = current_scene.get(key)
        incoming_value = incoming_scene.get(key)
        force_route = key in _BOARD_ROUTE_KEYS_V209K and route_downgraded
        missing_incoming = incoming_value in (None, "", False, [], {})
        audio_or_flag_key = any(token in key.lower() for token in ("audio", "vocal", "voice", "lip", "source_phrase", "source_word"))
        source_cut_key = key in {"video_node_role", "videoNodeRole", "skip_board_generation", "skipBoardGeneration", "source_or_generated", "sourceOrGenerated"}
        should_copy = force_route or missing_incoming or (current_is_lipsync and audio_or_flag_key) or (current_is_source_cut and source_cut_key)
        if should_copy and incoming_value != current_value:
            incoming_scene[key] = copy.deepcopy(current_value)
            changed += 1

    if current_is_lipsync:
        # Normalize aliases so the frontend cannot accidentally treat the scene as plain i2v.
        incoming_scene["route"] = current_scene.get("route") or current_scene.get("planned_route") or current_scene.get("plannedRoute") or "ia2v"
        incoming_scene["planned_route"] = incoming_scene["route"]
        incoming_scene["plannedRoute"] = incoming_scene["route"]
        incoming_scene["contains_vocal"] = True
        incoming_scene["containsVocal"] = True
        incoming_scene["lip_sync_required"] = True
        incoming_scene["lipSyncRequired"] = True
        changed += 1
    if current_is_source_cut:
        incoming_scene["route"] = "source_cut"
        incoming_scene["planned_route"] = "source_cut"
        incoming_scene["plannedRoute"] = "source_cut"
        incoming_scene["source_or_generated"] = "source"
        incoming_scene["sourceOrGenerated"] = "source"
        incoming_scene["video_node_role"] = "source_cut"
        incoming_scene["videoNodeRole"] = "source_cut"
        incoming_scene["skip_board_generation"] = True
        incoming_scene["skipBoardGeneration"] = True
        changed += 1
    return changed




# AVA_PROJECT_BOARD_PROMPT_PERSISTENCE_V213D
# Backend-side safety net: old/stale Board saves and Manual Timing authority saves may
# carry media/timing but empty prompt fields. Keep visible user-authored prompts from
# the current Board snapshot unless the incoming scene provides a non-empty replacement.
_AVA_BOARD_PROMPT_KEYS_V213D = (
    "video_prompt", "videoPrompt", "positive_prompt", "positivePrompt", "prompt",
    "negative_prompt", "negativePrompt", "video_motion_negative", "videoMotionNegative", "final_negative_prompt", "finalNegativePrompt",
    "sound_prompt", "soundPrompt", "mmaudio_prompt", "mmaudioPrompt",
    "mmaudio_negative_prompt", "mmaudioNegativePrompt", "negative_sound_prompt", "negativeSoundPrompt",
    "note", "notes", "scene_note", "sceneNote", "user_scene_note", "userSceneNote",
)


def _ava_v213d_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _ava_v213d_scene_id(scene, index=0) -> str:
    if isinstance(scene, dict):
        return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"seg_{index + 1:02d}")
    return f"seg_{index + 1:02d}"


def _ava_v213d_scenes(data):
    if not isinstance(data, dict):
        return []
    scenes = data.get("scenes")
    if isinstance(scenes, list):
        return scenes
    board = data.get("board")
    if isinstance(board, dict) and isinstance(board.get("scenes"), list):
        return board.get("scenes") or []
    return []


def _ava_v213d_prompt_score(data) -> int:
    score = 0
    for scene in _ava_v213d_scenes(data):
        if not isinstance(scene, dict):
            continue
        for key in _AVA_BOARD_PROMPT_KEYS_V213D:
            value = _ava_v213d_text(scene.get(key))
            if value:
                score += 1 + min(len(value), 500) // 80
    return score


def _ava_project_preserve_board_prompts_v213d(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    current_scenes = _ava_v213d_scenes(current_data)
    incoming_scenes = _ava_v213d_scenes(incoming_data)
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_v213d_scene_id(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_v213d_scenes(next_data)
    changed = 0
    changed_scene_ids = []

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_v213d_scene_id(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        scene_changed = False
        for key in _AVA_BOARD_PROMPT_KEYS_V213D:
            current_value = current_scene.get(key)
            current_text = _ava_v213d_text(current_value)
            if not current_text:
                continue
            incoming_text = _ava_v213d_text(scene.get(key))
            if incoming_text:
                continue
            scene[key] = copy.deepcopy(current_value)
            scene_changed = True
            changed += 1

        # Normalize visible prompt aliases so frontend/backend read the same text.
        video_text = _ava_v213d_text(scene.get("video_prompt") or scene.get("videoPrompt") or current_scene.get("video_prompt") or current_scene.get("videoPrompt") or current_scene.get("positive_prompt") or current_scene.get("prompt"))
        if video_text:
            for key in ("video_prompt", "videoPrompt", "positive_prompt", "prompt"):
                if not _ava_v213d_text(scene.get(key)):
                    scene[key] = video_text
                    scene_changed = True
                    changed += 1
        negative_text = _ava_v213d_text(scene.get("negative_prompt") or scene.get("negativePrompt") or current_scene.get("negative_prompt") or current_scene.get("negativePrompt"))
        if negative_text:
            for key in ("negative_prompt", "negativePrompt"):
                if not _ava_v213d_text(scene.get(key)):
                    scene[key] = negative_text
                    scene_changed = True
                    changed += 1
        if scene_changed:
            changed_scene_ids.append(scene_id)

    if not changed:
        return incoming_data, 0
    next_data["scenes"] = next_scenes
    next_data["boardPromptsPreservedV213D"] = True
    next_data["board_prompts_preserved_v213d"] = True
    print("[PROJECT BOARD PROMPTS PRESERVED V213D]", {
        "changedFields": changed,
        "changedScenes": changed_scene_ids[:40],
        "currentPromptScore": _ava_v213d_prompt_score(current_data),
        "incomingPromptScoreBefore": _ava_v213d_prompt_score(incoming_data),
        "incomingPromptScoreAfter": _ava_v213d_prompt_score(next_data),
    }, flush=True)
    return next_data, changed


_AVA_BOARD_PROMPT_META_KEYS_V218A = (
    "prompt_revision_v218a", "promptRevisionV218A",
    "prompt_import_epoch_v214x", "promptImportEpochV214X",
    "prompt_import_source_v214x", "promptImportSourceV214X",
    "prompt_local_authority_v214k2", "promptLocalAuthorityV214K2",
    "prompt_edit_epoch_v214k2", "promptEditEpochV214K2",
    "prompt_edit_at_v214k2", "promptEditAtV214K2",
    "prompt_local_authority_v214k", "promptLocalAuthorityV214K",
    "prompt_edit_epoch_v214k", "promptEditEpochV214K",
    "prompt_local_authority_v214j", "promptLocalAuthorityV214J",
    "prompt_edit_epoch_v214j", "promptEditEpochV214J",
)


def _ava_v218a_prompt_revision(scene) -> int:
    if not isinstance(scene, dict):
        return 0
    values = []
    for key in (
        "prompt_revision_v218a", "promptRevisionV218A",
        "prompt_import_epoch_v214x", "promptImportEpochV214X",
        "prompt_edit_epoch_v214k2", "promptEditEpochV214K2",
        "prompt_edit_epoch_v214k", "promptEditEpochV214K",
        "prompt_edit_epoch_v214j", "promptEditEpochV214J",
    ):
        try:
            value = int(float(scene.get(key) or 0))
        except Exception:
            value = 0
        if value > 0:
            values.append(value)
    return max(values or [0])


def _ava_project_apply_prompt_revision_authority_v218a(current_data, incoming_data):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, {"changedFields": 0, "changedScenes": []}
    current_scenes = _ava_v213d_scenes(current_data)
    incoming_scenes = _ava_v213d_scenes(incoming_data)
    if not current_scenes or not incoming_scenes:
        return incoming_data, {"changedFields": 0, "changedScenes": []}

    current_by_id = {
        _ava_v213d_scene_id(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }
    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_v213d_scenes(next_data)
    changed_fields = 0
    changed_scenes = []

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_v213d_scene_id(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue
        current_revision = _ava_v218a_prompt_revision(current_scene)
        incoming_revision = _ava_v218a_prompt_revision(scene)
        scene_changed = False

        if current_revision > incoming_revision:
            for key in (*_AVA_BOARD_PROMPT_KEYS_V213D, *_AVA_BOARD_PROMPT_META_KEYS_V218A):
                if key not in current_scene:
                    continue
                current_value = copy.deepcopy(current_scene.get(key))
                if scene.get(key) == current_value:
                    continue
                scene[key] = current_value
                changed_fields += 1
                scene_changed = True
        elif current_revision == incoming_revision:
            # Revision-less legacy saves still may not erase a populated prompt.
            for key in _AVA_BOARD_PROMPT_KEYS_V213D:
                current_value = current_scene.get(key)
                if not _ava_v213d_text(current_value):
                    continue
                if _ava_v213d_text(scene.get(key)):
                    continue
                scene[key] = copy.deepcopy(current_value)
                changed_fields += 1
                scene_changed = True

        if scene_changed:
            changed_scenes.append(scene_id)

    if not changed_fields:
        return incoming_data, {"changedFields": 0, "changedScenes": []}

    next_data["scenes"] = next_scenes
    next_data["board_prompt_revision_authority_v218a"] = True
    next_data["boardPromptRevisionAuthorityV218A"] = True
    return next_data, {
        "changedFields": changed_fields,
        "changedScenes": changed_scenes[:80],
    }


def _ava_project_board_image_upload_batch_isolation_v209k(current_snapshot, incoming_data, payload_client_version=""):
    if not isinstance(current_snapshot, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    if not _ava_project_board_batch_guard_active_v209k(current_snapshot):
        return incoming_data, 0
    if str(payload_client_version or "").startswith("board-server-video-batch"):
        return incoming_data, 0

    current_data = current_snapshot.get("data") if isinstance(current_snapshot.get("data"), dict) else {}
    current_scenes = _ava_board_scenes_v131q2(current_data) if "_ava_board_scenes_v131q2" in globals() else []
    incoming_scenes = _ava_board_scenes_v131q2(incoming_data) if "_ava_board_scenes_v131q2" in globals() else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    selected_scene_id = _ava_project_selected_scene_id_v209k(incoming_data)
    current_by_id = {
        _ava_project_scene_id_v209k(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    next_data = copy.deepcopy(incoming_data)
    next_scenes = _ava_board_scenes_v131q2(next_data) if "_ava_board_scenes_v131q2" in globals() else []
    changed = 0
    contract_scene_ids = []
    reset_scene_ids = []

    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_project_scene_id_v209k(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            continue

        copied = _ava_project_copy_contract_fields_v209k(current_scene, scene)
        if copied:
            changed += copied
            contract_scene_ids.append(scene_id)

        strong_changed = _ava_project_scene_strong_image_changed_v209k(current_scene, scene)
        is_selected_scene = bool(selected_scene_id and scene_id == selected_scene_id)
        if _ava_project_scene_has_reset_v209k(scene) and not is_selected_scene and not strong_changed:
            if _ava_project_clear_accidental_review_reset_v209k(scene):
                changed += 1
                reset_scene_ids.append(scene_id)

    if changed:
        next_data["scenes"] = next_scenes
        print("[PROJECT BOARD IMAGE UPLOAD BATCH ISOLATION V209K]", {
            "client_version": payload_client_version,
            "selectedSceneId": selected_scene_id,
            "contractScenes": contract_scene_ids[:30],
            "clearedAccidentalImageResetScenes": reset_scene_ids[:30],
            "changed": changed,
        }, flush=True)
        return next_data, changed
    return incoming_data, 0

# AVA_BACKEND_BOARD_MEDIA_SIMPLE_AUTHORITY_V215D:
# Backend safety net: if current Board has a newer committed image for a scene,
# an older delayed browser/status save must not erase that image or resurrect an old video.
_AVA_V215D_IMAGE_KEYS = (
    'image_url', 'imageUrl', 'image_api_path', 'imageApiPath', 'image_asset_id', 'imageAssetId',
    'image_name', 'imageName', 'image_data_url', 'imageDataUrl', 'mediaUrl', 'media_url',
    'first_frame_url', 'firstFrameUrl', 'first_frame_api_path', 'firstFrameApiPath',
    'first_frame_asset_id', 'firstFrameAssetId', 'first_frame_name', 'firstFrameName',
    'start_image_url', 'startImageUrl', 'start_image_api_path', 'startImageApiPath',
    'start_image_asset_id', 'startImageAssetId', 'start_image_name', 'startImageName',
    'first_image_url', 'firstImageUrl', 'first_image_api_path', 'firstImageApiPath',
    'first_image_asset_id', 'firstImageAssetId', 'first_image_name', 'firstImageName',
    'last_frame_url', 'lastFrameUrl', 'last_frame_api_path', 'lastFrameApiPath',
    'last_frame_asset_id', 'lastFrameAssetId', 'last_frame_name', 'lastFrameName',
    'end_image_url', 'endImageUrl', 'end_image_api_path', 'endImageApiPath',
    'end_image_asset_id', 'endImageAssetId', 'end_image_name', 'endImageName',
    'last_image_url', 'lastImageUrl', 'last_image_api_path', 'lastImageApiPath',
    'last_image_asset_id', 'lastImageAssetId', 'last_image_name', 'lastImageName',
    'image_status', 'imageStatus', 'image_mutation_epoch', 'imageMutationEpoch',
    'image_mutation_at', 'imageMutationAt', 'source_image_changed_at', 'sourceImageChangedAt',
    'source_image_changed_epoch', 'sourceImageChangedEpoch', 'mediaEditVersionV213G', 'media_edit_version_v213g',
)

_AVA_V215D_VIDEO_CLEAR_KEYS = (
    'video_status', 'videoStatus', 'video_error', 'videoError', 'video_job_id', 'videoJobId',
    'video_status_endpoint', 'videoStatusEndpoint', 'video_queue_position', 'videoQueuePosition',
    'video_url', 'videoUrl', 'video_api_path', 'videoApiPath', 'video_asset_id', 'videoAssetId',
    'video_name', 'videoName', 'result_url', 'resultUrl', 'result_video_url', 'resultVideoUrl',
    'result_video_api_path', 'resultVideoApiPath', 'result_video_asset_id', 'resultVideoAssetId',
    'result_video_name', 'resultVideoName', 'ready_video_url', 'readyVideoUrl',
    'generated_video_url', 'generatedVideoUrl', 'generated_video_api_path', 'generatedVideoApiPath',
    'generated_video_asset_id', 'generatedVideoAssetId', 'mmaudio_video_url', 'mmaudioVideoUrl',
    'mmaudio_video_api_path', 'mmaudioVideoApiPath', 'mmaudio_video_asset_id', 'mmaudioVideoAssetId',
    'video_source_image_asset_id', 'videoSourceImageAssetId', 'video_source_image_api_path', 'videoSourceImageApiPath',
)

def _ava_v215d_text(value: Any) -> str:
    return str(value or '').strip()

def _ava_v215d_scene_id(scene: dict[str, Any] | None, index: int = 0) -> str:
    if not isinstance(scene, dict):
        return f"seg_{index + 1:02d}"
    return _ava_v215d_text(scene.get('scene_id') or scene.get('sceneId') or scene.get('id') or f"seg_{index + 1:02d}")

def _ava_v215d_float(value: Any) -> float:
    try:
        result = float(value or 0)
        return result if result == result else 0.0
    except Exception:
        return 0.0

def _ava_v215d_parse_time(value: Any) -> float:
    text = _ava_v215d_text(value)
    if not text:
        return 0.0
    try:
        from datetime import datetime
        return datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp() * 1000.0
    except Exception:
        return 0.0

def _ava_v215d_media_epoch(scene: dict[str, Any] | None) -> float:
    if not isinstance(scene, dict):
        return 0.0
    values = [
        _ava_v215d_float(scene.get('image_mutation_epoch')),
        _ava_v215d_float(scene.get('imageMutationEpoch')),
        _ava_v215d_float(scene.get('source_image_changed_epoch')),
        _ava_v215d_float(scene.get('sourceImageChangedEpoch')),
        _ava_v215d_float(scene.get('mediaEditVersionV213G')),
        _ava_v215d_float(scene.get('media_edit_version_v213g')),
        _ava_v215d_parse_time(scene.get('source_image_changed_at')),
        _ava_v215d_parse_time(scene.get('sourceImageChangedAt')),
        _ava_v215d_parse_time(scene.get('image_mutation_at')),
        _ava_v215d_parse_time(scene.get('imageMutationAt')),
        _ava_v215d_parse_time(scene.get('manualImageReplaceCommittedAtV214V')),
        _ava_v215d_parse_time(scene.get('manual_image_replace_committed_at_v214v')),
        _ava_v215d_parse_time(scene.get('updatedAt') or scene.get('updated_at')),
    ]
    return max([v for v in values if v and v > 0] or [0.0])

def _ava_v215d_has_image(scene: dict[str, Any] | None) -> bool:
    if not isinstance(scene, dict):
        return False
    for key in _AVA_V215D_IMAGE_KEYS:
        value = scene.get(key)
        if isinstance(value, str) and value.strip():
            return True
        if key.endswith(('asset_id', 'assetId')) and value:
            return True
    return False

def _ava_v215d_copy_current_image_and_clear_video(current_scene: dict[str, Any], incoming_scene: dict[str, Any]) -> dict[str, Any]:
    merged = dict(incoming_scene or {})
    for key in _AVA_V215D_IMAGE_KEYS:
        if key in current_scene:
            merged[key] = current_scene.get(key)
    for key in _AVA_V215D_VIDEO_CLEAR_KEYS:
        if key in merged:
            merged[key] = '' if key not in ('video_queue_position', 'videoQueuePosition') else 0
    merged['video_result'] = None
    merged['videoResult'] = None
    merged['mmaudio_result'] = None
    merged['mmaudioResult'] = None
    merged['image_uploading'] = False
    merged['imageUploading'] = False
    merged['image_uploading_v129q'] = False
    merged['imageUploadingV129Q'] = False
    merged['image_authority_protected_v215d'] = True
    merged['imageAuthorityProtectedV215D'] = True
    merged['old_video_cleared_by_image_authority_v215d'] = 'backend_v215d'
    merged['oldVideoClearedByImageAuthorityV215D'] = 'backend_v215d'
    return merged

def _ava_v215d_protect_fresh_board_images(current_data: dict[str, Any] | None, incoming_data: dict[str, Any] | None, guard_mode: str = '') -> tuple[dict[str, Any] | None, int]:
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    current_scenes = current_data.get('scenes') if isinstance(current_data.get('scenes'), list) else []
    incoming_scenes = incoming_data.get('scenes') if isinstance(incoming_data.get('scenes'), list) else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0

    current_by_id = {
        _ava_v215d_scene_id(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }

    changed = 0
    next_scenes = []
    for index, scene in enumerate(incoming_scenes):
        if not isinstance(scene, dict):
            next_scenes.append(scene)
            continue
        scene_id = _ava_v215d_scene_id(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict):
            next_scenes.append(scene)
            continue

        current_has_image = _ava_v215d_has_image(current_scene)
        if not current_has_image:
            next_scenes.append(scene)
            continue

        current_epoch = _ava_v215d_media_epoch(current_scene)
        incoming_epoch = _ava_v215d_media_epoch(scene)
        incoming_has_image = _ava_v215d_has_image(scene)

        if current_epoch > incoming_epoch + 5 or (current_has_image and not incoming_has_image and current_epoch >= incoming_epoch):
            next_scenes.append(_ava_v215d_copy_current_image_and_clear_video(current_scene, scene))
            changed += 1
        else:
            next_scenes.append(scene)

    if not changed:
        return incoming_data, 0

    next_data = dict(incoming_data)
    next_data['scenes'] = next_scenes
    next_data['mediaMutationReplaceSave'] = True
    next_data['forceReplaceSave'] = True
    next_data['image_authority_protected_v215d'] = True
    next_data['imageAuthorityProtectedV215D'] = True
    print('[PROJECT BOARD FRESH IMAGE PROTECTED V215D]', {
        'guard_mode': guard_mode,
        'protectedScenes': changed,
        **media_refs_summary(next_data),
    }, flush=True)
    return next_data, changed



# AVA_BOARD_MEDIA_REDUCER_CONTRACT_V216A
_AVA_V216A_SCENE_MEDIA_KEYS = (
    'image_url','imageUrl','image_api_path','imageApiPath','image_asset_id','imageAssetId','image_name','imageName','image_data_url','imageDataUrl','mediaUrl','media_url',
    'first_frame_url','firstFrameUrl','first_frame_api_path','firstFrameApiPath','first_frame_asset_id','firstFrameAssetId','first_frame_name','firstFrameName',
    'start_image_url','startImageUrl','start_image_api_path','startImageApiPath','start_image_asset_id','startImageAssetId','start_image_name','startImageName','start_image_data_url','startImageDataUrl',
    'first_image_url','firstImageUrl','first_image_api_path','firstImageApiPath','first_image_asset_id','firstImageAssetId','first_image_name','firstImageName',
    'last_frame_url','lastFrameUrl','last_frame_api_path','lastFrameApiPath','last_frame_asset_id','lastFrameAssetId','last_frame_name','lastFrameName',
    'end_image_url','endImageUrl','end_image_api_path','endImageApiPath','end_image_asset_id','endImageAssetId','end_image_name','endImageName','end_image_data_url','endImageDataUrl',
    'last_image_url','lastImageUrl','last_image_api_path','lastImageApiPath','last_image_asset_id','lastImageAssetId','last_image_name','lastImageName',
    'image_status','imageStatus','photo_status','photoStatus','image_uploading','imageUploading','photo_uploading','photoUploading',
    'video_status','videoStatus','generation_status','generationStatus','batch_status','batchStatus','video_error','videoError','video_job_id','videoJobId','job_id','jobId',
    'video_status_endpoint','videoStatusEndpoint','video_queue_position','videoQueuePosition','video_queue_source','videoQueueSource',
    'video_url','videoUrl','video_api_path','videoApiPath','video_asset_id','videoAssetId','video_name','videoName','video_result','videoResult',
    'result_url','resultUrl','result_video_url','resultVideoUrl','result_video_api_path','resultVideoApiPath','result_video_asset_id','resultVideoAssetId','result_video_name','resultVideoName',
    'ready_video_url','readyVideoUrl','ready_video_api_path','readyVideoApiPath','ready_video_asset_id','readyVideoAssetId',
    'generated_video_url','generatedVideoUrl','generated_video_api_path','generatedVideoApiPath','generated_video_asset_id','generatedVideoAssetId',
    'output_video_url','outputVideoUrl','output_video_api_path','outputVideoApiPath','output_video_asset_id','outputVideoAssetId',
    'video_source_image_asset_id','videoSourceImageAssetId','video_source_image_api_path','videoSourceImageApiPath','video_source_image_mutation_epoch','videoSourceImageMutationEpoch',
    'video_source_revision_v216a','videoSourceRevisionV216A','generation_media_revision_v216a','generationMediaRevisionV216A','generation_source_image_asset_id_v216a','generationSourceImageAssetIdV216A',
    'review_status','reviewStatus','video_review_status','videoReviewStatus','pending_review','pendingReview','review_required','reviewRequired','needs_review','needsReview',
    'bad_video','badVideo','video_bad','videoBad','is_bad_video','isBadVideo','telegram_review_id','telegramReviewId','telegram_review_asset_id','telegramReviewAssetId','telegram_review_status','telegramReviewStatus',
    'mmaudio_status','mmaudioStatus','mmaudio_error','mmaudioError','mmaudio_job_id','mmaudioJobId','mmaudio_status_endpoint','mmaudioStatusEndpoint',
    'mmaudio_video_url','mmaudioVideoUrl','mmaudio_video_api_path','mmaudioVideoApiPath','mmaudio_video_asset_id','mmaudioVideoAssetId','mmaudio_video_name','mmaudioVideoName','mmaudio_result','mmaudioResult',
    'media_revision_v216a','mediaRevisionV216A','image_revision_v216a','imageRevisionV216A','media_revision_at_v216a','mediaRevisionAtV216A','media_reset_intent_v216a','mediaResetIntentV216A','media_authority_v216a','mediaAuthorityV216A',
    'image_mutation_epoch','imageMutationEpoch','source_image_changed_epoch','sourceImageChangedEpoch','source_image_changed_at','sourceImageChangedAt',
)

def _ava_v216a_scene_id(scene: dict[str, Any] | None, index: int = 0) -> str:
    if not isinstance(scene, dict):
        return f'seg_{index + 1:02d}'
    return str(scene.get('scene_id') or scene.get('sceneId') or scene.get('id') or f'seg_{index + 1:02d}').strip()

def _ava_v216a_number(value: Any) -> float:
    try:
        result = float(value or 0)
        return result if result == result else 0.0
    except Exception:
        return 0.0

def _ava_v216a_media_revision(scene: dict[str, Any] | None) -> float:
    if not isinstance(scene, dict):
        return 0.0
    return max(
        _ava_v216a_number(scene.get('media_revision_v216a')),
        _ava_v216a_number(scene.get('mediaRevisionV216A')),
        _ava_v216a_number(scene.get('image_revision_v216a')),
        _ava_v216a_number(scene.get('imageRevisionV216A')),
        _ava_v216a_number(scene.get('image_mutation_epoch')),
        _ava_v216a_number(scene.get('imageMutationEpoch')),
        _ava_v216a_number(scene.get('source_image_changed_epoch')),
        _ava_v216a_number(scene.get('sourceImageChangedEpoch')),
        0.0,
    )

def _ava_v216a_preserve_newer_scene_media(current_data: dict[str, Any] | None, incoming_data: dict[str, Any] | None, source: str = '') -> tuple[dict[str, Any] | None, int]:
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, 0
    current_scenes = current_data.get('scenes') if isinstance(current_data.get('scenes'), list) else []
    incoming_scenes = incoming_data.get('scenes') if isinstance(incoming_data.get('scenes'), list) else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, 0
    current_by_id = {_ava_v216a_scene_id(scene, index): scene for index, scene in enumerate(current_scenes) if isinstance(scene, dict)}
    changed = 0
    next_scenes = []
    for index, incoming_scene in enumerate(incoming_scenes):
        if not isinstance(incoming_scene, dict):
            next_scenes.append(incoming_scene)
            continue
        sid = _ava_v216a_scene_id(incoming_scene, index)
        current_scene = current_by_id.get(sid)
        if not isinstance(current_scene, dict):
            next_scenes.append(incoming_scene)
            continue
        current_rev = _ava_v216a_media_revision(current_scene)
        incoming_rev = _ava_v216a_media_revision(incoming_scene)
        if current_rev > 0 and incoming_rev < current_rev:
            merged = dict(incoming_scene)
            for key in _AVA_V216A_SCENE_MEDIA_KEYS:
                if key in current_scene:
                    merged[key] = copy.deepcopy(current_scene.get(key))
                else:
                    merged.pop(key, None)
            merged['stale_media_save_rejected_v216a'] = True
            merged['staleMediaSaveRejectedV216A'] = True
            merged['stale_media_save_source_v216a'] = source
            merged['staleMediaSaveSourceV216A'] = source
            next_scenes.append(merged)
            changed += 1
        else:
            next_scenes.append(incoming_scene)
    if not changed:
        return incoming_data, 0
    result = dict(incoming_data)
    result['scenes'] = next_scenes
    result['stale_media_saves_rejected_v216a'] = changed
    result['staleMediaSavesRejectedV216A'] = changed
    print('[BOARD STALE MEDIA SAVE REJECTED V216A]', {'source': source, 'scenes': changed}, flush=True)
    return result, changed


_AVA_V218B_VIDEO_FIELDS = (
    'video_status','videoStatus','generation_status','generationStatus','batch_status','batchStatus',
    'video_error','videoError','video_job_id','videoJobId','job_id','jobId',
    'video_status_endpoint','videoStatusEndpoint','video_queue_position','videoQueuePosition','video_queue_source','videoQueueSource',
    'video_url','videoUrl','video_api_path','videoApiPath','video_asset_id','videoAssetId','video_name','videoName','video_result','videoResult',
    'result_url','resultUrl','result_video_url','resultVideoUrl','result_video_api_path','resultVideoApiPath','result_video_asset_id','resultVideoAssetId','result_video_name','resultVideoName',
    'ready_video_url','readyVideoUrl','ready_video_api_path','readyVideoApiPath','ready_video_asset_id','readyVideoAssetId',
    'generated_video_url','generatedVideoUrl','generated_video_api_path','generatedVideoApiPath','generated_video_asset_id','generatedVideoAssetId',
    'output_video_url','outputVideoUrl','output_video_api_path','outputVideoApiPath','output_video_asset_id','outputVideoAssetId',
    'original_video_url','originalVideoUrl','video_ready_at','videoReadyAt','video_updated_at','videoUpdatedAt',
    'server_batch_job_id','serverBatchJobId','server_batch_status_endpoint','serverBatchStatusEndpoint',
    'video_source_image_asset_id','videoSourceImageAssetId','video_source_image_api_path','videoSourceImageApiPath','video_source_image_url','videoSourceImageUrl',
    'video_source_image_mutation_epoch','videoSourceImageMutationEpoch','video_source_revision_v216a','videoSourceRevisionV216A',
    'generation_media_revision_v216a','generationMediaRevisionV216A','generation_source_image_asset_id_v216a','generationSourceImageAssetIdV216A',
    'video_revision_v218b','videoRevisionV218B','video_ready_epoch_v218b','videoReadyEpochV218B',
)


def _ava_v218b_epoch(value: Any) -> float:
    try:
        numeric = float(value or 0)
        if numeric > 0:
            return numeric
    except Exception:
        pass
    try:
        text = str(value or '').strip()
        if not text:
            return 0.0
        if text.endswith('Z'):
            text = text[:-1] + '+00:00'
        dt = datetime.fromisoformat(text)
        return dt.timestamp() * 1000.0
    except Exception:
        return 0.0


def _ava_v218b_scene_has_video(scene: dict[str, Any] | None) -> bool:
    if not isinstance(scene, dict):
        return False
    return any(str(scene.get(key) or '').strip() for key in (
        'video_asset_id','videoAssetId','video_api_path','videoApiPath','video_url','videoUrl',
        'result_video_asset_id','resultVideoAssetId','result_video_api_path','resultVideoApiPath','result_video_url','resultVideoUrl',
        'output_video_asset_id','outputVideoAssetId','output_video_api_path','outputVideoApiPath','output_video_url','outputVideoUrl',
    ))


def _ava_v218b_video_revision(scene: dict[str, Any] | None) -> float:
    if not isinstance(scene, dict):
        return 0.0
    revision = max(
        _ava_v218b_epoch(scene.get('video_revision_v218b')),
        _ava_v218b_epoch(scene.get('videoRevisionV218B')),
        _ava_v218b_epoch(scene.get('video_ready_epoch_v218b')),
        _ava_v218b_epoch(scene.get('videoReadyEpochV218B')),
        _ava_v218b_epoch(scene.get('video_ready_at')),
        _ava_v218b_epoch(scene.get('videoReadyAt')),
        _ava_v218b_epoch(scene.get('video_updated_at')),
        _ava_v218b_epoch(scene.get('videoUpdatedAt')),
        0.0,
    )
    if revision > 0:
        return revision
    return 1.0 if _ava_v218b_scene_has_video(scene) else 0.0


def _ava_v218b_video_clear_revision(scene: dict[str, Any] | None) -> float:
    if not isinstance(scene, dict):
        return 0.0
    return max(
        _ava_v218b_epoch(scene.get('video_clear_revision_v218b')),
        _ava_v218b_epoch(scene.get('videoClearRevisionV218B')),
        _ava_v218b_epoch(scene.get('source_image_changed_epoch')),
        _ava_v218b_epoch(scene.get('sourceImageChangedEpoch')),
        _ava_v218b_epoch(scene.get('image_mutation_epoch')),
        _ava_v218b_epoch(scene.get('imageMutationEpoch')),
        0.0,
    )


def _ava_project_apply_video_revision_authority_v218b(current_data, incoming_data, source=''):
    if not isinstance(current_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data, {'changedFields': 0, 'changedScenes': []}
    current_scenes = current_data.get('scenes') if isinstance(current_data.get('scenes'), list) else []
    incoming_scenes = incoming_data.get('scenes') if isinstance(incoming_data.get('scenes'), list) else []
    if not current_scenes or not incoming_scenes:
        return incoming_data, {'changedFields': 0, 'changedScenes': []}
    current_by_id = {
        _ava_v216a_scene_id(scene, index): scene
        for index, scene in enumerate(current_scenes)
        if isinstance(scene, dict)
    }
    next_data = copy.deepcopy(incoming_data)
    next_scenes = next_data.get('scenes') if isinstance(next_data.get('scenes'), list) else []
    changed_fields = 0
    changed_scenes = []
    for index, scene in enumerate(next_scenes):
        if not isinstance(scene, dict):
            continue
        scene_id = _ava_v216a_scene_id(scene, index)
        current_scene = current_by_id.get(scene_id)
        if not isinstance(current_scene, dict) or not _ava_v218b_scene_has_video(current_scene):
            continue
        current_revision = _ava_v218b_video_revision(current_scene)
        incoming_revision = _ava_v218b_video_revision(scene)
        incoming_clear_revision = _ava_v218b_video_clear_revision(scene)
        if incoming_clear_revision > current_revision:
            continue
        if _ava_v218b_scene_has_video(scene) and incoming_revision >= current_revision:
            continue
        scene_changed = False
        for key in _AVA_V218B_VIDEO_FIELDS:
            if key in current_scene:
                value = copy.deepcopy(current_scene.get(key))
                if scene.get(key) != value:
                    scene[key] = value
                    changed_fields += 1
                    scene_changed = True
            elif key in scene:
                scene.pop(key, None)
                changed_fields += 1
                scene_changed = True
        if scene_changed:
            scene['stale_video_save_rejected_v218b'] = True
            scene['staleVideoSaveRejectedV218B'] = True
            scene['stale_video_save_source_v218b'] = source
            scene['staleVideoSaveSourceV218B'] = source
            changed_scenes.append(scene_id)
    if not changed_fields:
        return incoming_data, {'changedFields': 0, 'changedScenes': []}
    next_data['scenes'] = next_scenes
    next_data['board_video_revision_authority_v218b'] = True
    next_data['boardVideoRevisionAuthorityV218B'] = True
    return next_data, {'changedFields': changed_fields, 'changedScenes': changed_scenes[:100]}


def _ava_v217c_board_preview_state(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    value = data.get('boardPreviewV217A') or data.get('board_preview_v217a') or {}
    return value if isinstance(value, dict) else {}


def _ava_v217c_board_preview_revision(preview: Any) -> int:
    if not isinstance(preview, dict):
        return 0
    value = (
        preview.get('revisionV217C')
        or preview.get('revision_v217c')
        or preview.get('mutationRevisionV217C')
        or preview.get('mutation_revision_v217c')
        or 0
    )
    try:
        return max(0, int(float(value)))
    except (TypeError, ValueError):
        return 0


def _ava_v217c_apply_board_preview_authority(current_data: Any, incoming_data: Any) -> tuple[Any, dict[str, Any] | None]:
    if not isinstance(incoming_data, dict):
        return incoming_data, None
    current_preview = _ava_v217c_board_preview_state(current_data)
    incoming_preview = _ava_v217c_board_preview_state(incoming_data)
    if not current_preview and not incoming_preview:
        return incoming_data, None

    current_revision = _ava_v217c_board_preview_revision(current_preview)
    incoming_revision = _ava_v217c_board_preview_revision(incoming_preview)
    # Equal revision means the server copy is already authoritative. Only a strictly
    # newer incoming revision may replace it, including replacing remarks with [].
    incoming_wins = bool(incoming_preview) and incoming_revision > current_revision
    winner_preview = incoming_preview if incoming_wins else current_preview
    winner = 'incoming' if incoming_wins else 'current'

    merged = copy.deepcopy(incoming_data)
    if winner_preview:
        merged['boardPreviewV217A'] = copy.deepcopy(winner_preview)
    else:
        merged.pop('boardPreviewV217A', None)
    merged.pop('board_preview_v217a', None)
    info = {
        'winner': winner,
        'currentRevision': current_revision,
        'incomingRevision': incoming_revision,
        'remarks': len(winner_preview.get('remarks') or []) if isinstance(winner_preview, dict) else 0,
        'changed': _ava_v217c_board_preview_state(incoming_data) != winner_preview,
    }
    return merged, info


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
        # AVA_TIMING_TO_BOARD_DURATION_AUTHORITY_V212S:
        # guard_mode='replace' must be a real full replacement. Earlier it still
        # ran safe media-preservation blocks, so stale Board videos/audio slices
        # could come back after Manual Timing was merged/split.
        is_replace_snapshot = payload.guard_mode == 'replace'
        is_destructive_clear = (
            is_replace_snapshot
            and not (payload.data or {})
            and str(payload.client_version or '').startswith('workflow-stage-controls-clear')
        )
        if is_destructive_clear:
            cleanup = cleanup_project_stage_media(db, project_id, stage, user_id=project.get('user_id'))
        incoming_data, removed_runtime = sanitize_snapshot_runtime_media(payload.data or {})
        if stage == 'board' and current:
            incoming_data, board_preview_authority_v217c = _ava_v217c_apply_board_preview_authority(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data or {},
            )
            if board_preview_authority_v217c and board_preview_authority_v217c.get('changed'):
                print('[BOARD PREVIEW AUTHORITY V217C]', {
                    'project_id': project_id,
                    **board_preview_authority_v217c,
                }, flush=True)
        if stage == 'board' and current:
            incoming_data, rejected_stale_media_v216a = _ava_v216a_preserve_newer_scene_media(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data or {},
                source=f'project_snapshot:{payload.guard_mode or "safe_merge"}',
            )
            # Legacy V215D is only a fallback for old revision-less safe_merge clients.
            # It must never override an explicit replace/delete with a newer V216A revision.
            if not is_replace_snapshot:
                incoming_data, protected_fresh_images_v215d = _ava_v215d_protect_fresh_board_images(
                    current.get('data') if isinstance(current, dict) else {},
                    incoming_data or {},
                    payload.guard_mode or '',
                )
                if protected_fresh_images_v215d:
                    preserved_media_refs = int(locals().get('preserved_media_refs', 0) or 0) + protected_fresh_images_v215d

        if stage == 'board' and current and not is_destructive_clear:
            incoming_data, video_revision_authority_v218b = _ava_project_apply_video_revision_authority_v218b(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data or {},
                source=f'project_snapshot:{payload.guard_mode or "safe_merge"}',
            )
            if video_revision_authority_v218b.get('changedFields'):
                print('[PROJECT BOARD VIDEO REVISION AUTHORITY V218B]', {
                    'project_id': project_id,
                    'stage': stage,
                    'guardMode': payload.guard_mode,
                    **video_revision_authority_v218b,
                }, flush=True)

        if stage == 'board' and current:
            incoming_data, prompt_revision_authority_v218a = _ava_project_apply_prompt_revision_authority_v218a(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data or {},
            )
            if prompt_revision_authority_v218a.get("changedFields"):
                print('[PROJECT BOARD PROMPT REVISION AUTHORITY V218A]', {
                    'project_id': project_id,
                    'stage': stage,
                    'guardMode': payload.guard_mode,
                    **prompt_revision_authority_v218a,
                }, flush=True)

        if stage == 'manual_timing':
            incoming_data, normalized_v212s3, info_v212s3 = _ava_v212s3_normalize_manual_timing_data(incoming_data or {})
            if normalized_v212s3:
                print('[MANUAL TIMING SINGLE SCENE NORMALIZED V212S3]', {
                    'project_id': project_id,
                    **info_v212s3,
                }, flush=True)
        timing_authority_forced_replace_v212s2 = False
        if stage == 'board':
            manual_snapshot_v212s2 = (db.get('snapshots', {}).get(project_id, {}) or {}).get('manual_timing') or {}
            manual_data_v212s2 = manual_snapshot_v212s2.get('data') if isinstance(manual_snapshot_v212s2, dict) else {}
            drift_v212s2, manual_sig_v212s2, board_sig_v212s2 = _ava_v212s2_signatures_differ(manual_data_v212s2 or {}, incoming_data or {})
            if drift_v212s2:
                if _ava_v212v_board_has_user_edit_markers(incoming_data or {}) or not _ava_v212u_can_apply_manual_timing_authority(manual_sig_v212s2, board_sig_v212s2):
                    print('[BOARD TIMING AUTHORITY SAVE SKIPPED USER EDIT V212U]', {
                        'project_id': project_id,
                        'reason': _ava_v212v_skip_reason_for_data(incoming_data or {}, manual_sig_v212s2, board_sig_v212s2),
                        'manualSig': manual_sig_v212s2[:3],
                        'incomingSig': board_sig_v212s2[:3],
                        'manualBoardMarkerV212V': _ava_v212v_board_has_user_edit_markers(incoming_data or {}),
                    }, flush=True)
                else:
                    incoming_data, applied_v212s2, reason_v212s2 = _ava_v212s2_apply_manual_timing_to_board(incoming_data or {}, manual_data_v212s2 or {}, clear_stale_media=True)
                    if applied_v212s2:
                        timing_authority_forced_replace_v212s2 = True
                        incoming_data, preserved_v212u = _ava_v212u_preserve_board_media_after_timing_authority(
                            current.get('data') if isinstance(current, dict) else {},
                            incoming_data or {},
                        )
                        if preserved_v212u:
                            print('[BOARD TIMING AUTHORITY SAVE MEDIA PRESERVED V212U]', {
                                'project_id': project_id,
                                'preservedMediaRefs': preserved_v212u,
                                'manualSig': manual_sig_v212s2[:3],
                                'incomingSig': board_sig_v212s2[:3],
                            }, flush=True)
                        incoming_data, preserved_prompts_v213d = _ava_project_preserve_board_prompts_v213d(
                            current.get('data') if isinstance(current, dict) else {},
                            incoming_data or {},
                        )
                        if preserved_prompts_v213d:
                            print('[BOARD TIMING AUTHORITY SAVE PROMPTS PRESERVED V213D]', {
                                'project_id': project_id,
                                'preservedPromptFields': preserved_prompts_v213d,
                                'manualSig': manual_sig_v212s2[:3],
                                'incomingSig': board_sig_v212s2[:3],
                            }, flush=True)
                        # Do not let generic old current Board preservation resurrect stale 3-second media/timing.
                        current = None
                        print('[BOARD TIMING AUTHORITY SAVE APPLIED V212S2]', {
                        'project_id': project_id,
                        'reason': reason_v212s2,
                        'manualSig': manual_sig_v212s2[:3],
                        'incomingSig': board_sig_v212s2[:3],
                        'sceneCount': len(_ava_v212s2_scenes(incoming_data)),
                    }, flush=True)
        if stage == 'video_node' and is_destructive_clear:
            incoming_data = _ava_video_node_clear_tombstone_v209b(payload.client_version or '')
        if stage == 'video_node' and payload.guard_mode == 'safe_merge' and current:
            current_data_v209b = current.get('data') if isinstance(current, dict) else {}
            if _ava_video_node_should_block_stale_save_after_clear_v209b(current_data_v209b, incoming_data):
                print('[PROJECT VIDEO_NODE STALE SAVE BLOCKED AFTER CLEAR V209B]', {
                    'project_id': project_id,
                    'stage': stage,
                    'incoming_client_version': payload.client_version,
                    'clearMs': _ava_video_node_clear_ms_v209b(current_data_v209b),
                    'incomingMs': _ava_video_node_data_ms_v209b(incoming_data),
                    **media_refs_summary(incoming_data),
                })
                return {
                    'saved': False,
                    'reason': 'video_node_stale_save_blocked_after_clear_v209b',
                    'snapshot': current,
                    '_skip_store_write_v200c': True,
                }
        if stage == 'board' and current and not is_replace_snapshot:
            incoming_data, isolated_scene_contracts_v209k = _ava_project_board_image_upload_batch_isolation_v209k(
                current,
                incoming_data,
                payload.client_version,
            )
            if isolated_scene_contracts_v209k:
                preserved_media_refs = 0

            old_score = state_richness(current.get('data') or {})
            new_score = state_richness(incoming_data)
            if old_score > 10 and new_score < max(3, old_score // 4):
                return {
                    'saved': False,
                    'reason': 'incoming_snapshot_too_poor_to_overwrite_saved_state',
                    'old_score': old_score,
                    'new_score': new_score,
                    'snapshot': current,
                    '_skip_store_write_v200c': True,
                }
            incoming_data, preserved_media_refs = preserve_media_refs(current.get('data') or {}, incoming_data)
            incoming_data, preserved_prompt_fields_v213d = _ava_project_preserve_board_prompts_v213d(current.get('data') or {}, incoming_data)
            if preserved_prompt_fields_v213d:
                preserved_media_refs += preserved_prompt_fields_v213d
                print('[PROJECT BOARD PROMPT FIELDS PRESERVED V213D]', {
                    'project_id': project_id,
                    'stage': stage,
                    'preservedPromptFields': preserved_prompt_fields_v213d,
                    **media_refs_summary(incoming_data),
                }, flush=True)
        else:
            preserved_media_refs = 0

        board_server_video_preserved_v131q2 = 0
        # AVA_PROJECT_FORCE_CLEAR_ON_CHANGED_IMAGE_V132M must run before all preserve guards.
        if stage == 'board' and current and not is_replace_snapshot:
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

        if stage == 'board' and current and not is_replace_snapshot:
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

        if stage == 'board' and current and not is_replace_snapshot:
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

        if stage == 'board' and current and not is_replace_snapshot:
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

        if stage == 'board' and current and not is_replace_snapshot:
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

        if stage == 'board' and current and not is_replace_snapshot:
            incoming_data, review_cleared_v133b = _ava_project_clear_review_on_image_change_v133b(incoming_data)
            if review_cleared_v133b:
                print('[PROJECT BOARD REVIEW CLEAR SUMMARY V133B]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedReviewStates': review_cleared_v133b,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_replace_snapshot:
            incoming_data, stale_video_cleared_v133d = _ava_project_clear_stale_v132j_video_refs_v133d(current, incoming_data)
            if stale_video_cleared_v133d:
                print('[PROJECT BOARD STALE V132J VIDEO CLEAR SUMMARY V133D]', {
                    'project_id': project_id,
                    'stage': stage,
                    'clearedStaleVideoRefs': stale_video_cleared_v133d,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_replace_snapshot:
            incoming_data, review_event_authority_v136d = _ava_project_apply_review_event_authority_v136d(
                payload.data or {},
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if review_event_authority_v136d:
                preserved_media_refs += review_event_authority_v136d
                print('[PROJECT BOARD REVIEW EVENT AUTHORITY SUMMARY V136D]', {
                    'project_id': project_id,
                    'stage': stage,
                    'appliedReviewEvents': review_event_authority_v136d,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and current and not is_replace_snapshot:
            incoming_data, server_review_memory_v136e = _ava_project_apply_server_review_memory_v136e(
                payload.data or {},
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if server_review_memory_v136e:
                preserved_media_refs += server_review_memory_v136e
                print('[PROJECT BOARD SERVER REVIEW MEMORY SUMMARY V136E]', {
                    'project_id': project_id,
                    'stage': stage,
                    'appliedReviewMemory': server_review_memory_v136e,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'board' and not is_replace_snapshot:
            incoming_data, telegram_review_notes_v137c = _ava_project_apply_telegram_review_note_memory_v137c(
                db,
                project_id,
                payload.data or {},
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if telegram_review_notes_v137c:
                preserved_media_refs += telegram_review_notes_v137c
                print('[PROJECT BOARD TELEGRAM REVIEW NOTE MEMORY SUMMARY V137C]', {
                    'project_id': project_id,
                    'stage': stage,
                    'appliedTelegramReviewNotes': telegram_review_notes_v137c,
                    **media_refs_summary(incoming_data),
                })


        if stage == 'board_assembly' and current and not is_replace_snapshot:
            incoming_data, assembly_final_preserved_v200p = _ava_project_preserve_board_assembly_final_v200p(
                current.get('data') if isinstance(current, dict) else {},
                incoming_data,
            )
            if assembly_final_preserved_v200p:
                preserved_media_refs += assembly_final_preserved_v200p
                print('[PROJECT BOARD ASSEMBLY FINAL PRESERVED V200P]', {
                    'project_id': project_id,
                    'stage': stage,
                    'preservedAssemblyFinalRefs': assembly_final_preserved_v200p,
                    **media_refs_summary(incoming_data),
                })

        if stage == 'audio_studio' and current and not is_replace_snapshot and payload.guard_mode == 'safe_merge':
            incoming_data, audio_studio_preserved_v211y2 = preserve_media_refs(current.get('data') or {}, incoming_data)
            if audio_studio_preserved_v211y2:
                preserved_media_refs += audio_studio_preserved_v211y2
                print('[PROJECT AUDIO_STUDIO MEDIA REFS PRESERVED V211Y2]', {
                    'project_id': project_id,
                    'stage': stage,
                    'preservedAudioStudioMediaRefs': audio_studio_preserved_v211y2,
                    **media_refs_summary(incoming_data),
                })

        if current and cleanup is None and not is_replace_snapshot:
            current_data_for_noop_v200b = current.get('data') if isinstance(current, dict) else {}
            if _ava_project_snapshot_noop_equal_v200b(current_data_for_noop_v200b, incoming_data):
                return {
                    'saved': False,
                    'reason': 'noop_snapshot_same_data_v200b',
                    'snapshot': current,
                    '_skip_store_write_v200c': True,
                }

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
