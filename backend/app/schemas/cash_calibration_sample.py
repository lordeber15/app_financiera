from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CashCalibrationSampleCreate(BaseModel):
    denomination_cents: int = Field(gt=0)
    hue: float = Field(ge=0, le=360)
    saturation: float = Field(ge=0, le=1)
    value: float = Field(ge=0, le=1)
    size_ratio: float = Field(ge=0, le=1)


class CashCalibrationSampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    denomination_cents: int
    hue: float
    saturation: float
    value: float
    size_ratio: float
    captured_at: datetime
