from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WebhookLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    payload: dict
    status_code: int | None
    success: bool
    error: str | None
    attempts: int
    created_at: datetime
