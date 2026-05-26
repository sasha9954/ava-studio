from fastapi import APIRouter
from app.api.routes import auth, credits, health, projects, workspace

api_router = APIRouter(prefix='/api')
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(workspace.router)
api_router.include_router(credits.router)
