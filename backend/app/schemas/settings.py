from pydantic import BaseModel, ConfigDict, Field


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    timezone: str
    webhook_url: str | None
    webhook_header_name: str | None
    webhook_header_value: str | None
    webhook_enabled: bool
    notify_expense: bool
    notify_budget: bool
    budget_thresholds: str
    summary_daily_enabled: bool
    summary_daily_time: str
    summary_weekly_enabled: bool
    summary_weekly_day: int
    summary_weekly_time: str


class SettingsUpdate(BaseModel):
    currency: str | None = None
    timezone: str | None = None
    webhook_url: str | None = None
    webhook_header_name: str | None = None
    webhook_header_value: str | None = None
    webhook_enabled: bool | None = None
    notify_expense: bool | None = None
    notify_budget: bool | None = None
    budget_thresholds: str | None = None
    summary_daily_enabled: bool | None = None
    summary_daily_time: str | None = None
    summary_weekly_enabled: bool | None = None
    summary_weekly_day: int | None = Field(default=None, ge=0, le=6)
    summary_weekly_time: str | None = None


class WebhookTestRequest(BaseModel):
    """Valores a probar. Si se omiten, se usan los ya guardados en Configuración.
    Así el botón "Probar" prueba lo que hay escrito en el formulario aunque
    todavía no se haya pulsado "Guardar cambios"."""

    webhook_url: str | None = None
    webhook_header_name: str | None = None
    webhook_header_value: str | None = None


class WebhookTestResult(BaseModel):
    success: bool
    status_code: int | None
    error: str | None
