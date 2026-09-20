"""Acceso a la fila única de configuración (id=1), creándola con valores por
defecto si todavía no existe."""

from sqlalchemy.orm import Session

from app.models.settings import AppSettings


def get_or_create_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if settings is None:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
