"""Scheduler de resúmenes diario/semanal.

Se reprograma cada vez que cambian los settings (ver router de settings), para
que un cambio de hora o de habilitado/deshabilitado tenga efecto inmediato sin
reiniciar el servidor.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.settings_store import get_or_create_settings
from app.services import summaries

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None

DAILY_JOB_ID = "summary-daily"
WEEKLY_JOB_ID = "summary-weekly"


def _run_daily_summary() -> None:
    db = SessionLocal()
    try:
        settings = get_or_create_settings(db)
        summaries.send_daily_summary(db, settings)
    except Exception:
        logger.exception("Error enviando el resumen diario")
    finally:
        db.close()


def _run_weekly_summary() -> None:
    db = SessionLocal()
    try:
        settings = get_or_create_settings(db)
        summaries.send_weekly_summary(db, settings)
    except Exception:
        logger.exception("Error enviando el resumen semanal")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler | None:
    global _scheduler
    if not get_settings().scheduler_enabled:
        return None
    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler()
    _scheduler.start()
    reschedule_jobs()
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def reschedule_jobs() -> None:
    """Lee los settings actuales y (re)programa los jobs diario/semanal."""
    if _scheduler is None:
        return

    db = SessionLocal()
    try:
        settings = get_or_create_settings(db)
    finally:
        db.close()

    for job_id in (DAILY_JOB_ID, WEEKLY_JOB_ID):
        existing = _scheduler.get_job(job_id)
        if existing:
            _scheduler.remove_job(job_id)

    if settings.summary_daily_enabled:
        hour, minute = _parse_hhmm(settings.summary_daily_time)
        _scheduler.add_job(
            _run_daily_summary,
            CronTrigger(hour=hour, minute=minute, timezone=settings.timezone),
            id=DAILY_JOB_ID,
            replace_existing=True,
        )

    if settings.summary_weekly_enabled:
        hour, minute = _parse_hhmm(settings.summary_weekly_time)
        # APScheduler usa day_of_week 0=lunes..6=domingo, igual que nuestra convención.
        _scheduler.add_job(
            _run_weekly_summary,
            CronTrigger(
                day_of_week=settings.summary_weekly_day,
                hour=hour,
                minute=minute,
                timezone=settings.timezone,
            ),
            id=WEEKLY_JOB_ID,
            replace_existing=True,
        )


def _parse_hhmm(value: str) -> tuple[int, int]:
    hour_str, minute_str = value.split(":")
    return int(hour_str), int(minute_str)
