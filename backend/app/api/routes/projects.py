from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.snapshot_media import media_refs_summary, preserve_media_refs, sanitize_snapshot_runtime_media
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.schemas import ProjectCreateRequest, ProjectUpdateRequest, SnapshotSaveRequest

router = APIRouter(prefix='/projects', tags=['projects'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator'}
PROJECT_THEME_COUNT = 8


def project_public(project: dict) -> dict:
    return {k: v for k, v in project.items() if k != 'user_id'}


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


def build_project_summary(snapshots: dict) -> dict:
    manual = (snapshots.get('manual_timing') or {}).get('data') or {}
    podcast = (snapshots.get('podcast') or {}).get('data') or {}
    board = (snapshots.get('board') or {}).get('data') or {}
    assembly = (snapshots.get('board_assembly') or {}).get('data') or {}
    video_node = (snapshots.get('video_node') or {}).get('data') or {}
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
            'segments_count': count_items(video_node, ['segments']),
            'candidates_count': count_items(video_node, ['candidates', 'selected_candidates']),
            'final_video_ready': has_any(video_node, ['final_video_url', 'finalVideoUrl', 'output_url']),
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
        p['updated_at'] = now_iso()
        return {'project': project_public(p)}

    return store.update(op)


@router.delete('/{project_id}')
def delete_project(project: dict = Depends(ensure_project_access)):
    project_id = project['id']

    def op(db):
        p = db['projects'][project_id]
        p['status'] = 'deleted'
        p['deleted_at'] = now_iso()
        p['updated_at'] = now_iso()
        return {'deleted': True, 'project_id': project_id}

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
        return {'saved': True, 'snapshot': snapshot}

    return store.update(op)
