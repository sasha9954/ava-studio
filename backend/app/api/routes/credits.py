from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.core.storage import store

router = APIRouter(prefix='/credits', tags=['credits'])


@router.get('/summary')
def credits_summary(user: dict = Depends(get_current_user)):
    db = store.get_db()
    ledger = [item for item in db['credits_ledger'] if item.get('user_id') == user['id']]
    ledger.sort(key=lambda item: item.get('created_at', ''), reverse=True)
    return {
        'balance': user.get('credits_balance', 0),
        'ledger': ledger[:50],
        'packages': [
            {'id': 'pack_50', 'credits': 50, 'label': '50 credits'},
            {'id': 'pack_100', 'credits': 100, 'label': '100 credits'},
            {'id': 'pack_300', 'credits': 300, 'label': '300 credits'},
            {'id': 'pack_1000', 'credits': 1000, 'label': '1000 credits'},
        ],
    }
