# AVA_PROJECT_MODES_PACK_V1
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
    project_mode: dict[str, Any] | None = None  # AVA_PROJECT_MODES_PACK_V1


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    status: str | None = None
    description: str | None = None
    project_mode: dict[str, Any] | None = None  # AVA_PROJECT_MODES_PACK_V1


class SnapshotSaveRequest(BaseModel):
    data: dict[str, Any]
    client_version: str | None = None
    guard_mode: Literal['safe_merge', 'replace'] = 'safe_merge'


class CreditInviteRequest(BaseModel):
    code: str = Field(min_length=1, max_length=80)


class CreditTopupRequest(BaseModel):
    package_id: str = Field(min_length=1, max_length=80)


class CreditChargeRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=120)
    amount: int = Field(gt=0, le=10000)
    action_type: str = Field(default='manual_charge', min_length=1, max_length=120)
    project_id: str | None = None


class CreditRefundRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=120)
    reason: str = Field(default='manual_refund', max_length=200)
