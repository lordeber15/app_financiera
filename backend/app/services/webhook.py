"""Envío de eventos al webhook de n8n configurado por el usuario.

Todo envío queda registrado en `webhook_logs`, tenga éxito o no, para que la UI
pueda mostrar el historial y permitir reintentos manuales. El envío nunca debe
bloquear ni romper la operación que lo disparó (crear un gasto, calcular un
presupuesto, etc.) — cualquier excepción de red se captura y se guarda como log.
"""

from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.settings import AppSettings
from app.models.webhook_log import WebhookLog

TIMEOUT_SECONDS = 10
MAX_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = [1, 3]  # pausas entre reintentos (len == MAX_ATTEMPTS - 1)


def build_payload(event: str, data: dict, currency: str) -> dict:
    return {
        "event": event,
        "sent_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "currency": currency,
        "data": data,
    }


def _post_with_retries(url: str, json_body: dict, headers: dict) -> tuple[int | None, bool, str | None, int]:
    last_error: str | None = None
    last_status: int | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = httpx.post(url, json=json_body, headers=headers, timeout=TIMEOUT_SECONDS)
            last_status = response.status_code
            if response.is_success:
                return last_status, True, None, attempt
            last_error = f"HTTP {response.status_code}: {response.text[:500]}"
        except httpx.HTTPError as exc:
            last_error = f"{type(exc).__name__}: {exc}"

        if attempt < MAX_ATTEMPTS:
            import time

            time.sleep(_RETRY_BACKOFF_SECONDS[attempt - 1])

    return last_status, False, last_error, MAX_ATTEMPTS


def _dispatch(
    db: Session,
    event: str,
    data: dict,
    currency: str,
    url: str,
    header_name: str | None,
    header_value: str | None,
) -> WebhookLog:
    """Arma el payload, lo envía (con reintentos) y siempre deja constancia en `webhook_logs`."""
    payload = build_payload(event, data, currency)

    headers = {"Content-Type": "application/json"}
    if header_name and header_value:
        headers[header_name] = header_value

    status_code, success, error, attempts = _post_with_retries(url, payload, headers)

    log = WebhookLog(
        event_type=event,
        payload=payload,
        status_code=status_code,
        success=success,
        error=error,
        attempts=attempts,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def send_event(db: Session, settings: AppSettings, event: str, data: dict) -> WebhookLog | None:
    """Envía un evento real (gasto, presupuesto, resumen) solo si el webhook está
    habilitado y configurado; si no, no hace nada (ni registra log)."""
    if not settings.webhook_enabled or not settings.webhook_url:
        return None
    return _dispatch(
        db, event, data, settings.currency, settings.webhook_url,
        settings.webhook_header_name, settings.webhook_header_value,
    )


def send_test(
    db: Session,
    settings: AppSettings,
    url: str | None,
    header_name: str | None,
    header_value: str | None,
) -> WebhookLog | None:
    """Prueba manual desde Configuración: usa la URL/headers indicados (normalmente
    los del formulario, aunque todavía no se hayan guardado) e ignora el interruptor
    `webhook_enabled`, para poder validar la conexión antes de activarlo."""
    if not url:
        return None
    return _dispatch(
        db, "test", {"message": "Webhook de prueba desde la app"}, settings.currency,
        url, header_name, header_value,
    )


def retry_log(db: Session, settings: AppSettings, log: WebhookLog) -> WebhookLog:
    """Reintenta el envío de un log existente reutilizando su payload original."""
    if not settings.webhook_url:
        log.success = False
        log.error = "No hay webhook_url configurada"
        db.commit()
        db.refresh(log)
        return log

    headers = {"Content-Type": "application/json"}
    if settings.webhook_header_name and settings.webhook_header_value:
        headers[settings.webhook_header_name] = settings.webhook_header_value

    status_code, success, error, attempts = _post_with_retries(settings.webhook_url, log.payload, headers)

    log.status_code = status_code
    log.success = success
    log.error = error
    log.attempts += attempts
    db.commit()
    db.refresh(log)
    return log
