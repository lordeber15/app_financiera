from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, HTTPException, status

from app.core.config import get_settings

settings = get_settings()

COOKIE_NAME = "session"
_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str) -> bool:
    """Valida la contraseña ingresada contra APP_PASSWORD_HASH (preferido) o APP_PASSWORD."""
    if settings.app_password_hash:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), settings.app_password_hash.encode("utf-8"))
        except ValueError:
            return False
    if settings.app_password is not None:
        return plain == settings.app_password
    return False


def create_session_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "owner",
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_session_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])


def require_auth(session: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> None:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        decode_session_token(session)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida o expirada")
