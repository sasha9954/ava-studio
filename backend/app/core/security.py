import hashlib
import hmac
import secrets
from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def hash_password(password: str, salt: str | None = None) -> dict:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode('utf-8')).hexdigest()
    return {"salt": salt, "hash": digest}


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    candidate = hashlib.sha256(f"{salt}:{password}".encode('utf-8')).hexdigest()
    return hmac.compare_digest(candidate, password_hash)


def make_token() -> str:
    return secrets.token_urlsafe(32)
