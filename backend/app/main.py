from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.scheduler import shutdown_scheduler, start_scheduler
from app.routers import (
    auth,
    cash_calibration,
    categories,
    expenses,
    reports,
    settings as settings_router,
    webhook_logs,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="Notificaciones Financieras API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cash_calibration.router)
app.include_router(categories.router)
app.include_router(expenses.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(webhook_logs.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
