from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.scheduler import reschedule_jobs
from app.core.security import require_auth
from app.core.settings_store import get_or_create_settings
from app.schemas.settings import SettingsOut, SettingsUpdate, WebhookTestRequest, WebhookTestResult
from app.services import webhook

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_auth)])


@router.get("", response_model=SettingsOut)
def read_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)


@router.put("", response_model=SettingsOut)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    reschedule_jobs()
    return settings


@router.post("/webhook/test", response_model=WebhookTestResult)
def test_webhook(body: WebhookTestRequest | None = None, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)

    # Si el frontend manda valores (los del formulario, aunque no estén guardados
    # aún), se usan esos; si no manda body, se prueba con lo ya guardado.
    url = body.webhook_url if body and body.webhook_url is not None else settings.webhook_url
    header_name = (
        body.webhook_header_name if body and body.webhook_header_name is not None else settings.webhook_header_name
    )
    header_value = (
        body.webhook_header_value
        if body and body.webhook_header_value is not None
        else settings.webhook_header_value
    )

    log = webhook.send_test(db, settings, url, header_name, header_value)
    if log is None:
        return WebhookTestResult(success=False, status_code=None, error="Configura una URL de webhook antes de probar")
    return WebhookTestResult(success=log.success, status_code=log.status_code, error=log.error)
