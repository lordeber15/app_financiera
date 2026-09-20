from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AppSettings(Base):
    """Fila única (id=1) con la configuración global de la app."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    currency: Mapped[str] = mapped_column(String(10), default="PEN")
    timezone: Mapped[str] = mapped_column(String(60), default="America/Lima")

    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    webhook_header_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    webhook_header_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    webhook_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    notify_expense: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_budget: Mapped[bool] = mapped_column(Boolean, default=True)
    # Umbrales separados por coma, ej. "80,100"
    budget_thresholds: Mapped[str] = mapped_column(String(50), default="80,100")

    summary_daily_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    summary_daily_time: Mapped[str] = mapped_column(String(5), default="21:00")  # HH:MM

    summary_weekly_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # 0=lunes ... 6=domingo (convención isoweekday-1)
    summary_weekly_day: Mapped[int] = mapped_column(Integer, default=6)
    summary_weekly_time: Mapped[str] = mapped_column(String(5), default="21:00")

    @property
    def threshold_list(self) -> list[int]:
        return [int(t.strip()) for t in self.budget_thresholds.split(",") if t.strip()]
