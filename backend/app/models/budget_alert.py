from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class BudgetAlertSent(Base):
    """Evita reenviar la misma alerta de umbral dos veces en el mismo mes."""

    __tablename__ = "budget_alerts_sent"
    __table_args__ = (
        UniqueConstraint("category_id", "period", "threshold_pct", name="uq_budget_alert"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # "YYYY-MM"
    threshold_pct: Mapped[int] = mapped_column(Integer, nullable=False)
