from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict[str, Any]


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = 'clip'
    format: str = '16:9'
    description: str = ''


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    status: str | None = None
    description: str | None = None


class SnapshotSaveRequest(BaseModel):
    data: dict[str, Any]
    client_version: str | None = None
    guard_mode: Literal['safe_merge', 'replace'] = 'safe_merge'
