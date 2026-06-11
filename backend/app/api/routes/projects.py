from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.snapshot_media import media_refs_summary, preserve_media_refs, sanitize_snapshot_runtime_media
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.core.media_cleanup import cleanup_project_media, cleanup_project_stage_media
from app.schemas import ProjectCreateRequest, ProjectUpdateRequest, SnapshotSaveRequest

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
