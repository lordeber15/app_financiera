import os

# Variables de entorno de prueba, deben fijarse ANTES de importar `app.*`
# porque Settings se cachea con @lru_cache en el primer import.
os.environ["APP_PASSWORD"] = "test-password"
os.environ["JWT_SECRET"] = "test-secret-key-for-tests-only-not-for-prod"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.db import Base, get_db
from app.main import app


@pytest.fixture()
def db_session():
    """Un engine SQLite en memoria, nuevo por test, compartido entre hilos
    (StaticPool) para que BackgroundTasks vea las mismas tablas."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    # Parcheamos SessionLocal usado por las background tasks para que apunten
    # al mismo engine en memoria del test.
    import app.core.db as db_module
    import app.routers.expenses as expenses_module
    import app.core.scheduler as scheduler_module

    original_session_local = db_module.SessionLocal
    db_module.SessionLocal = TestingSessionLocal
    expenses_module.SessionLocal = TestingSessionLocal
    scheduler_module.SessionLocal = TestingSessionLocal

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield TestingSessionLocal

    app.dependency_overrides.clear()
    db_module.SessionLocal = original_session_local
    expenses_module.SessionLocal = original_session_local
    scheduler_module.SessionLocal = original_session_local
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    """Evita que los reintentos del webhook (con backoff real) ralenticen los tests."""
    import time

    monkeypatch.setattr(time, "sleep", lambda seconds: None)


@pytest.fixture()
def client(db_session):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_client(client):
    response = client.post("/auth/login", json={"password": "test-password"})
    assert response.status_code == 200
    return client
