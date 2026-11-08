"""
Teacher authentication for the Mergington High School API.

Teacher accounts are stored in ``teachers.json`` as salted PBKDF2 hashes.
Sessions are kept in memory and identified by random bearer tokens.
"""

import hashlib
import hmac
import json
import secrets
import time
from pathlib import Path
from typing import Dict, Optional

from fastapi import Header, HTTPException

TEACHERS_FILE = Path(__file__).parent / "teachers.json"
SESSION_TTL_SECONDS = 8 * 60 * 60
PBKDF2_ITERATIONS = 200_000

# token -> {"username": str, "expires_at": float}
_sessions: Dict[str, dict] = {}


def hash_password(password: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, hash_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), hash_hex)


_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def load_teachers() -> Dict[str, dict]:
    """Read teacher accounts from disk so password changes apply without a restart."""
    if not TEACHERS_FILE.exists():
        return {}
    with TEACHERS_FILE.open() as f:
        data = json.load(f)
    return {t["username"]: t for t in data.get("teachers", [])}


def authenticate(username: str, password: str) -> Optional[dict]:
    teacher = load_teachers().get(username)
    if teacher is None:
        # Spend comparable time for unknown users to avoid leaking which usernames exist
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, teacher.get("password_hash", "")):
        return None
    return teacher


def create_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "username": username,
        "expires_at": time.time() + SESSION_TTL_SECONDS,
    }
    return token


def end_session(token: str) -> None:
    _sessions.pop(token, None)


def get_session(token: str) -> Optional[dict]:
    session = _sessions.get(token)
    if session is None:
        return None
    if session["expires_at"] < time.time():
        _sessions.pop(token, None)
        return None
    return session


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def require_teacher(authorization: Optional[str] = Header(default=None)) -> dict:
    """FastAPI dependency that only allows logged-in teachers through."""
    token = _extract_token(authorization)
    session = get_session(token) if token else None
    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Teacher login required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    teacher = load_teachers().get(session["username"])
    if teacher is None:
        end_session(token)
        raise HTTPException(status_code=401, detail="Teacher login required")
    return {"token": token, "username": teacher["username"],
            "display_name": teacher.get("display_name", teacher["username"])}
