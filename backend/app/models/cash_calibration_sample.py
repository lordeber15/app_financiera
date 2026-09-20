from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CashCalibrationSample(Base):
    __tablename__ = "cash_calibration_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    denomination_cents: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    hue: Mapped[float] = mapped_column(Float, nullable=False)
    saturation: Mapped[float] = mapped_column(Float, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    size_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
