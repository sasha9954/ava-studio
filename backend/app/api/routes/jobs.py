from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import ensure_project_access, get_current_user
from app.core.security import make_id, now_iso
from app.core.storage import store

router = APIRouter(prefix='/jobs', tags=['jobs'])

STAGES = {'manual_timing', 'podcast', 'board', 'board_assembly', 'video_node', 'generator', 'audio_studio'}


class JobCreateRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=80)
    action_type: str = Field(default='test_job', min_length=1, max_length=120)
    cost: int = Field(default=1, ge=0, le=10000)
    project_id: str | None = None
    workspace: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)


class JobCompleteRequest(BaseModel):
    result_url: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class JobFailRequest(BaseModel):
    reason: str = Field(default='job_failed', max_length=200)
    refund: bool = True
    meta: dict[str, Any] = Field(default_factory=dict)


def public_user(user: dict) -> dict:
    return {
        'id': user['id'],
        'name': user['name'],
        'email': user['email'],
        'created_at': user['created_at'],
        'credits_balance': user.get('credits_balance', 0),
    }


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


def public_job(job: dict) -> dict:
    return {key: value for key, value in job.items() if key != 'user_id'}


def append_ledger(db: dict, item: dict) -> dict:
    entry = {
        'id': make_id('cl'),
        'created_at': now_iso(),
        **item,
    }
    db['credits_ledger'].append(entry)
    return entry


def already_refunded(db: dict, user_id: str, job_id: str) -> bool:
    return any(
        item.get('user_id') == user_id
        and item.get('job_id') == job_id
        and item.get('action_type') == 'job_refund'
        for item in db['credits_ledger']
    )


@router.get('')
def list_jobs(user: dict = Depends(get_current_user)):
    db = store.get_db()
    jobs = [public_job(job) for job in db['jobs'].values() if job.get('user_id') == user['id']]
    jobs.sort(key=lambda item: item.get('updated_at', ''), reverse=True)
    return {'jobs': jobs[:80]}


@router.get('/{job_id}')
def get_job(job_id: str, user: dict = Depends(get_current_user)):
    db = store.get_db()
    job = db['jobs'].get(job_id)
    if not job or job.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Job not found')
    return {'job': public_job(job)}


@router.post('')
def create_job(payload: JobCreateRequest, user: dict = Depends(get_current_user)):
    if payload.stage not in STAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown stage')
    if payload.project_id:
        ensure_project_access(payload.project_id, user)

    def op(db):
        current_user = db['users'][user['id']]
        workspace_id = None
        if not payload.project_id:
            workspace_id = get_or_create_workspace(db, user)['id']

        before = current_user.get('credits_balance', 0)
        if before < payload.cost:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail='Недостаточно кредитов')

        job_id = make_id('job')
        after = before - payload.cost
        current_user['credits_balance'] = after
        current_user['updated_at'] = now_iso()

        ledger_item = None
        if payload.cost > 0:
            ledger_item = append_ledger(db, {
                'user_id': user['id'],
                'project_id': payload.project_id,
                'workspace_id': workspace_id,
                'job_id': job_id,
                'action_type': 'job_charge',
                'amount': -payload.cost,
                'before_balance': before,
                'after_balance': after,
                'meta': {'stage': payload.stage, 'job_action': payload.action_type},
            })

        job = {
            'id': job_id,
            'user_id': user['id'],
            'project_id': payload.project_id,
            'workspace_id': workspace_id,
            'stage': payload.stage,
            'action_type': payload.action_type,
            'status': 'queued',
            'cost': payload.cost,
            'charged': payload.cost > 0,
            'refunded': False,
            'result_url': None,
            'error': None,
            'meta': payload.meta,
            'ledger_id': ledger_item.get('id') if ledger_item else None,
            'created_at': now_iso(),
            'updated_at': now_iso(),
        }
        db['jobs'][job_id] = job
        return {'ok': True, 'job': public_job(job), 'user': public_user(current_user), 'ledger_item': ledger_item}

    return store.update(op)


@router.post('/{job_id}/complete')
def complete_job(job_id: str, payload: JobCompleteRequest, user: dict = Depends(get_current_user)):
    def op(db):
        job = db['jobs'].get(job_id)
        if not job or job.get('user_id') != user['id']:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Job not found')
        job['status'] = 'completed'
        job['result_url'] = payload.result_url
        job['meta'] = {**(job.get('meta') or {}), **payload.meta}
        job['updated_at'] = now_iso()
        return {'ok': True, 'job': public_job(job), 'user': public_user(db['users'][user['id']])}
    return store.update(op)


@router.post('/{job_id}/fail')
def fail_job(job_id: str, payload: JobFailRequest, user: dict = Depends(get_current_user)):
    def op(db):
        job = db['jobs'].get(job_id)
        if not job or job.get('user_id') != user['id']:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Job not found')

        current_user = db['users'][user['id']]
        job['status'] = 'failed'
        job['error'] = payload.reason
        job['meta'] = {**(job.get('meta') or {}), **payload.meta}
        job['updated_at'] = now_iso()

        ledger_item = None
        if payload.refund and job.get('charged') and not job.get('refunded') and not already_refunded(db, user['id'], job_id):
            before = current_user.get('credits_balance', 0)
            amount = int(job.get('cost') or 0)
            after = before + amount
            current_user['credits_balance'] = after
            current_user['updated_at'] = now_iso()
            job['refunded'] = True
            ledger_item = append_ledger(db, {
                'user_id': user['id'],
                'project_id': job.get('project_id'),
                'workspace_id': job.get('workspace_id'),
                'job_id': job_id,
                'action_type': 'job_refund',
                'amount': amount,
                'before_balance': before,
                'after_balance': after,
                'meta': {'reason': payload.reason},
            })

        return {'ok': True, 'job': public_job(job), 'user': public_user(current_user), 'ledger_item': ledger_item}
    return store.update(op)
