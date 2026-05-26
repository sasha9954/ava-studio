from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()
settings.storage_path.mkdir(parents=True, exist_ok=True)
settings.static_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.app_name, version='0.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router)
app.mount('/static', StaticFiles(directory=str(settings.static_path)), name='static')


@app.get('/')
def root():
    return {'ok': True, 'app': settings.app_name, 'docs': '/docs'}
