from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(prefix='/health', tags=['health'])


@router.get('')
def health():
    settings = get_settings()
    return {
        'ok': True,
        'app': settings.app_name,
        'env': settings.env,
    }
