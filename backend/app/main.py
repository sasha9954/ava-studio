from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()
settings.storage_path.mkdir(parents=True, exist_ok=True)
settings.static_path.mkdir(parents=True, exist_ok=True)
print(f"[CORS CONFIG ACTIVE] allowed_origins={settings.cors_origin_list}", flush=True)

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

# AVA_STATIC_API_COMPAT_V203J:
# Some frontend/static normalization paths can request /api/static/assets/...
# while the canonical mount is /static/assets/...
# Keep both working so extracted Board frames do not 404.
app.mount('/api/static', StaticFiles(directory=str(settings.static_path)), name='api_static_compat_v203j')


@app.get('/')
def root():
    return {'ok': True, 'app': settings.app_name, 'docs': '/docs'}
