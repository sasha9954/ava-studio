from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import ensure_project_access, get_current_user
from app.core.security import make_id, now_iso
from app.core.storage import store
from app.schemas import CreditChargeRequest, CreditInviteRequest, CreditRefundRequest, CreditTopupRequest

router = APIRouter(prefix='/credits', tags=['credits'])

ADMIN_INVITE_CODE = '99541984'
ADMIN_INVITE_CREDITS = 1000

PACKAGES = {
    'pack_50': 50,
    'pack_100': 100,
    'pack_300': 300,
    'pack_1000': 1000,
}


def credit_packages() -> list[dict]:
    return [
        {'id': 'pack_50', 'credits': 50, 'label': '50 credits'},
        {'id': 'pack_100', 'credits': 100, 'label': '100 credits'},
        {'id': 'pack_300', 'credits': 300, 'label': '300 credits'},
        {'id': 'pack_1000', 'credits': 1000, 'label': '1000 credits'},
    ]


def public_user(user: dict) -> dict:
    return {
        'id': user['id'],
        'name': user['name'],
        'email': user['email'],
        'created_at': user['created_at'],
        'credits_balance': user.get('credits_balance', 0),
    }


def append_ledger(db: dict, item: dict) -> dict:
    entry = {
        'id': make_id('cl'),
        'created_at': now_iso(),
        **item,
    }
    db['credits_ledger'].append(entry)
    return entry


@router.get('/summary')
def credits_summary(user: dict = Depends(get_current_user)):
    db = store.get_db()
    ledger = [item for item in db['credits_ledger'] if item.get('user_id') == user['id']]
    ledger.sort(key=lambda item: item.get('created_at', ''), reverse=True)
    invite_used = any(item.get('action_type') == 'invite_admin_1000' for item in ledger)
    return {
        'balance': user.get('credits_balance', 0),
        'invite_used': invite_used,
        'ledger': ledger[:50],
        'packages': credit_packages(),
    }


@router.post('/invite')
def apply_invite_code(payload: CreditInviteRequest, user: dict = Depends(get_current_user)):
    code = payload.code.strip()
    if code != ADMIN_INVITE_CODE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Неверный инвайт-код')

    def op(db):
        current_user = db['users'][user['id']]
        already_used = any(
            item.get('user_id') == user['id'] and item.get('action_type') == 'invite_admin_1000'
            for item in db['credits_ledger']
        )
        if already_used:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Инвайт-код уже применён для этого аккаунта')

        before = current_user.get('credits_balance', 0)
        after = max(before, ADMIN_INVITE_CREDITS)
        amount = after - before
        current_user['credits_balance'] = after
        current_user['updated_at'] = now_iso()
        ledger_item = append_ledger(db, {
            'user_id': user['id'],
            'project_id': None,
            'job_id': None,
            'action_type': 'invite_admin_1000',
            'amount': amount,
            'before_balance': before,
            'after_balance': after,
            'meta': {'code': 'admin-invite', 'mode': 'demo_unlimited_1000'},
        })
        return {'ok': True, 'balance': after, 'ledger_item': ledger_item, 'user': public_user(current_user)}

    return store.update(op)


@router.post('/topup-demo')
def topup_demo(payload: CreditTopupRequest, user: dict = Depends(get_current_user)):
    package_id = payload.package_id.strip()
    credits = PACKAGES.get(package_id)
    if not credits:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unknown package')

    def op(db):
        current_user = db['users'][user['id']]
        before = current_user.get('credits_balance', 0)
        after = before + credits
        current_user['credits_balance'] = after
        current_user['updated_at'] = now_iso()
        ledger_item = append_ledger(db, {
            'user_id': user['id'],
            'project_id': None,
            'job_id': None,
            'action_type': 'topup_demo',
            'amount': credits,
            'before_balance': before,
            'after_balance': after,
            'meta': {'package_id': package_id},
        })
        return {'ok': True, 'balance': after, 'ledger_item': ledger_item, 'user': public_user(current_user)}

    return store.update(op)


@router.post('/charge')
def charge_credits(payload: CreditChargeRequest, user: dict = Depends(get_current_user)):
    if payload.project_id:
        ensure_project_access(payload.project_id, user)

    def op(db):
        current_user = db['users'][user['id']]
        existing = next((
            item for item in db['credits_ledger']
            if item.get('user_id') == user['id']
            and item.get('job_id') == payload.job_id
            and item.get('action_type') == payload.action_type
            and item.get('amount', 0) < 0
        ), None)
        if existing:
            return {'ok': True, 'duplicate': True, 'balance': current_user.get('credits_balance', 0), 'ledger_item': existing, 'user': public_user(current_user)}

        before = current_user.get('credits_balance', 0)
        if before < payload.amount:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail='Недостаточно кредитов')
        after = before - payload.amount
        current_user['credits_balance'] = after
        current_user['updated_at'] = now_iso()
        ledger_item = append_ledger(db, {
            'user_id': user['id'],
            'project_id': payload.project_id,
            'job_id': payload.job_id,
            'action_type': payload.action_type,
            'amount': -payload.amount,
            'before_balance': before,
            'after_balance': after,
            'meta': {'idempotency': 'one_job_one_charge'},
        })
        return {'ok': True, 'duplicate': False, 'balance': after, 'ledger_item': ledger_item, 'user': public_user(current_user)}

    return store.update(op)


@router.post('/refund')
def refund_credits(payload: CreditRefundRequest, user: dict = Depends(get_current_user)):
    def op(db):
        current_user = db['users'][user['id']]
        charge = next((
            item for item in db['credits_ledger']
            if item.get('user_id') == user['id']
            and item.get('job_id') == payload.job_id
            and item.get('amount', 0) < 0
        ), None)
        if not charge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Charge not found for this job_id')

        already_refunded = any(
            item.get('user_id') == user['id']
            and item.get('job_id') == payload.job_id
            and item.get('action_type') == 'refund'
            for item in db['credits_ledger']
        )
        if already_refunded:
            return {'ok': True, 'duplicate': True, 'balance': current_user.get('credits_balance', 0), 'user': public_user(current_user)}

        amount = abs(charge.get('amount', 0))
        before = current_user.get('credits_balance', 0)
        after = before + amount
        current_user['credits_balance'] = after
        current_user['updated_at'] = now_iso()
        ledger_item = append_ledger(db, {
            'user_id': user['id'],
            'project_id': charge.get('project_id'),
            'job_id': payload.job_id,
            'action_type': 'refund',
            'amount': amount,
            'before_balance': before,
            'after_balance': after,
            'meta': {'reason': payload.reason},
        })
        return {'ok': True, 'duplicate': False, 'balance': after, 'ledger_item': ledger_item, 'user': public_user(current_user)}

    return store.update(op)
