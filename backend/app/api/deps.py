from fastapi import Depends, Header, HTTPException, status
from app.core.storage import store


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing bearer token')
    token = authorization.split(' ', 1)[1].strip()
    db = store.get_db()
    session = db['sessions'].get(token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')
    user = db['users'].get(session['user_id'])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')
    return user


def ensure_project_access(project_id: str, user: dict = Depends(get_current_user)) -> dict:
    db = store.get_db()
    project = db['projects'].get(project_id)
    if not project or project.get('user_id') != user['id']:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Project not found')
    return project
