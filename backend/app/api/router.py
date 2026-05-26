from fastapi import APIRouter
from app.api.routes import auth, credits, health, jobs, projects, storage, workspace

api_router = APIRouter(prefix='/api')
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(workspace.router)
api_router.include_router(jobs.router)
api_router.include_router(storage.router)
api_router.include_router(credits.router)
