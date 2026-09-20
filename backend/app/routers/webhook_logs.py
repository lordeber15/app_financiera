from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_auth
from app.core.settings_store import get_or_create_settings
from app.models.webhook_log import WebhookLog
from app.schemas.webhook_log import WebhookLogOut
from app.services import webhook

router = APIRouter(prefix="/webhook-logs", tags=["webhook-logs"], dependencies=[Depends(require_auth)])


@router.get("", response_model=list[WebhookLogOut])
def list_logs(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    stmt = select(WebhookLog).order_by(WebhookLog.created_at.desc()).limit(limit)
    return db.scalars(stmt).all()


@router.post("/{log_id}/retry", response_model=WebhookLogOut)
def retry_log(log_id: int, db: Session = Depends(get_db)):
    log = db.get(WebhookLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    settings = get_or_create_settings(db)
    return webhook.retry_log(db, settings, log)
