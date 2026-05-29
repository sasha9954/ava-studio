from fastapi import APIRouter
from app.api.routes.ltx_board import router as ltx_board_router
from app.api.routes.podcast_audio import router as podcast_audio_router
from app.api.routes import asr, assets, auth, credits, health, jobs, projects, storage, workspace

api_router = APIRouter(prefix='/api')
api_router.include_router(ltx_board_router)
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(workspace.router)
api_router.include_router(jobs.router)
api_router.include_router(storage.router)
api_router.include_router(assets.router)
api_router.include_router(asr.router)
api_router.include_router(credits.router)


api_router.include_router(podcast_audio_router, tags=["podcast-audio"])
