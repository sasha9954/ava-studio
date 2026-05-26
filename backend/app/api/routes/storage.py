from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.storage import store

router = APIRouter(prefix='/storage', tags=['storage'])


def safe_file_size(path) -> int:
    try:
        return path.stat().st_size if path.exists() else 0
    except OSError:
        return 0


def count_user_project_snapshots(db: dict, user_id: str) -> int:
    project_ids = [p['id'] for p in db['projects'].values() if p.get('user_id') == user_id]
    return sum(len(db['snapshots'].get(project_id, {})) for project_id in project_ids)


def count_user_workspace_snapshots(db: dict, user_id: str) -> int:
    workspace_ids = [w['id'] for w in db['workspaces'].values() if w.get('user_id') == user_id]
    return sum(len(db['workspace_snapshots'].get(workspace_id, {})) for workspace_id in workspace_ids)


@router.get('/summary')
def storage_summary(user: dict = Depends(get_current_user)):
    settings = get_settings()
    db = store.get_db()
    user_projects = [p for p in db['projects'].values() if p.get('user_id') == user['id'] and p.get('status') != 'deleted']
    deleted_projects = [p for p in db['projects'].values() if p.get('user_id') == user['id'] and p.get('status') == 'deleted']
    user_workspaces = [w for w in db['workspaces'].values() if w.get('user_id') == user['id']]
    user_jobs = [j for j in db['jobs'].values() if j.get('user_id') == user['id']]
    user_ledger = [item for item in db['credits_ledger'] if item.get('user_id') == user['id']]

    db_size = safe_file_size(store.db_path)

    return {
        'app': settings.app_name,
        'env': settings.env,
        'storage_path': str(settings.storage_path),
        'db_path': str(store.db_path),
        'db_size_bytes': db_size,
        'db_size_mb': round(db_size / (1024 * 1024), 3),
        'current_user': {
            'id': user['id'],
            'name': user.get('name'),
            'email': user.get('email'),
            'credits_balance': user.get('credits_balance', 0),
            'created_at': user.get('created_at'),
        },
        'counts': {
            'all_users': len(db['users']),
            'all_projects': len(db['projects']),
            'user_projects': len(user_projects),
            'user_deleted_projects': len(deleted_projects),
            'user_workspaces': len(user_workspaces),
            'user_project_snapshots': count_user_project_snapshots(db, user['id']),
            'user_workspace_snapshots': count_user_workspace_snapshots(db, user['id']),
            'user_jobs': len(user_jobs),
            'user_credits_ledger': len(user_ledger),
        },
        'jobs': sorted(
            [
                {
                    'id': job.get('id'),
                    'stage': job.get('stage'),
                    'status': job.get('status'),
                    'cost': job.get('cost'),
                    'charged': job.get('charged'),
                    'refunded': job.get('refunded'),
                    'project_id': job.get('project_id'),
                    'workspace_id': job.get('workspace_id'),
                    'updated_at': job.get('updated_at'),
                    'error': job.get('error'),
                }
                for job in user_jobs
            ],
            key=lambda item: item.get('updated_at') or '',
            reverse=True,
        )[:20],
        'workspaces': [
            {
                'id': workspace.get('id'),
                'name': workspace.get('name'),
                'status': workspace.get('status'),
                'ttl_days': workspace.get('ttl_days'),
                'updated_at': workspace.get('updated_at'),
                'snapshots_count': len(db['workspace_snapshots'].get(workspace.get('id'), {})),
            }
            for workspace in user_workspaces
        ],
        'projects_preview': [
            {
                'id': project.get('id'),
                'name': project.get('name'),
                'status': project.get('status'),
                'format': project.get('format'),
                'updated_at': project.get('updated_at'),
                'snapshots_count': len(db['snapshots'].get(project.get('id'), {})),
            }
            for project in sorted(user_projects, key=lambda item: item.get('updated_at') or '', reverse=True)[:12]
        ],
    }


@router.get('/backup')
def storage_backup(user: dict = Depends(get_current_user)):
    db = store.get_db()
    user_project_ids = [p['id'] for p in db['projects'].values() if p.get('user_id') == user['id']]
    user_workspace_ids = [w['id'] for w in db['workspaces'].values() if w.get('user_id') == user['id']]

    return {
        'schema': 'ava_studio_user_backup_v1',
        'user': {
            'id': user['id'],
            'name': user.get('name'),
            'email': user.get('email'),
            'credits_balance': user.get('credits_balance', 0),
            'created_at': user.get('created_at'),
        },
        'projects': [p for p in db['projects'].values() if p.get('user_id') == user['id']],
        'project_snapshots': {project_id: db['snapshots'].get(project_id, {}) for project_id in user_project_ids},
        'workspaces': [w for w in db['workspaces'].values() if w.get('user_id') == user['id']],
        'workspace_snapshots': {workspace_id: db['workspace_snapshots'].get(workspace_id, {}) for workspace_id in user_workspace_ids},
        'jobs': [j for j in db['jobs'].values() if j.get('user_id') == user['id']],
        'credits_ledger': [item for item in db['credits_ledger'] if item.get('user_id') == user['id']],
    }
