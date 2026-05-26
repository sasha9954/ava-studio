from fastapi import APIRouter, HTTPException, status, Depends
from app.api.deps import get_current_user
from app.core.security import hash_password, make_id, make_token, now_iso, verify_password
from app.core.storage import store
from app.schemas import AuthResponse, LoginRequest, RegisterRequest

router = APIRouter(prefix='/auth', tags=['auth'])


def public_user(user: dict) -> dict:
    return {
        'id': user['id'],
        'name': user['name'],
        'email': user['email'],
        'created_at': user['created_at'],
        'credits_balance': user.get('credits_balance', 20),
    }


@router.post('/register', response_model=AuthResponse)
def register(payload: RegisterRequest):
    email = payload.email.lower().strip()

    def op(db):
        for existing in db['users'].values():
            if existing['email'] == email:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

        user_id = make_id('u')
        password = hash_password(payload.password)
        user = {
            'id': user_id,
            'name': payload.name.strip(),
            'email': email,
            'password_salt': password['salt'],
            'password_hash': password['hash'],
            'credits_balance': 20,
            'created_at': now_iso(),
            'updated_at': now_iso(),
        }
        token = make_token()
        db['users'][user_id] = user
        db['sessions'][token] = {'user_id': user_id, 'created_at': now_iso()}
        db['credits_ledger'].append({
            'id': make_id('cl'),
            'user_id': user_id,
            'project_id': None,
            'action_type': 'signup_bonus',
            'amount': 20,
            'before_balance': 0,
            'after_balance': 20,
            'created_at': now_iso(),
        })
        return {'token': token, 'user': public_user(user)}

    return store.update(op)


@router.post('/login', response_model=AuthResponse)
def login(payload: LoginRequest):
    email = payload.email.lower().strip()

    def op(db):
        user = next((u for u in db['users'].values() if u['email'] == email), None)
        if not user or not verify_password(payload.password, user['password_salt'], user['password_hash']):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')
        token = make_token()
        db['sessions'][token] = {'user_id': user['id'], 'created_at': now_iso()}
        return {'token': token, 'user': public_user(user)}

    return store.update(op)


@router.get('/me')
def me(user: dict = Depends(get_current_user)):
    return {'user': public_user(user)}
