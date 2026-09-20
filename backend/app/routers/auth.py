from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.security import COOKIE_NAME, create_session_token, require_auth, verify_password
from app.core.config import get_settings
from app.schemas.auth import LoginRequest, MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=MeResponse)
def login(body: LoginRequest, response: Response) -> MeResponse:
    if not verify_password(body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contraseña incorrecta")

    token = create_session_token()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_hours * 3600,
    )
    return MeResponse()


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=MeResponse, dependencies=[Depends(require_auth)])
def me() -> MeResponse:
    return MeResponse()
