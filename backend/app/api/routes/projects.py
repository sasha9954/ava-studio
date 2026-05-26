from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.schemas import ProjectCreateRequest, ProjectUpdateRequest, SnapshotSaveRequest

router = APIRouter(prefix='/projects', tags=['projects'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator'}


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


@router.get('')
def list_projects(user: dict = Depends(get_current_user)):
    db = store.get_db()
    projects = [project_public(p) for p in db['projects'].values() if p.get('user_id') == user['id']]
    projects.sort(key=lambda p: p.get('updated_at', ''), reverse=True)
    return {'projects': projects}


@router.post('')
def create_project(payload: ProjectCreateRequest, user: dict = Depends(get_current_user)):
    def op(db):
        project_id = make_id('p')
        project = {
            'id': project_id,
            'user_id': user['id'],
            'name': payload.name.strip(),
            'type': payload.type,
            'format': payload.format,
            'description': payload.description,
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
    return {'project': project_public(project)}


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


@router.get('/{project_id}/snapshots/{stage}')
def get_snapshot(stage: str, project: dict = Depends(ensure_project_access)):
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')
    db = store.get_db()
    snapshot = db['snapshots'].get(project['id'], {}).get(stage)
    return {'snapshot': snapshot or {'stage': stage, 'data': {}, 'updated_at': None}}


@router.post('/{project_id}/snapshots/{stage}')
def save_snapshot(stage: str, payload: SnapshotSaveRequest, project: dict = Depends(ensure_project_access)):
    if stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')
    project_id = project['id']

    def op(db):
        db['snapshots'].setdefault(project_id, {})
        current = db['snapshots'][project_id].get(stage)
        incoming_data = payload.data or {}
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
