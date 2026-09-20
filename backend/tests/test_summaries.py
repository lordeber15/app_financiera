from datetime import date

import respx
from httpx import Response

from app.core.settings_store import get_or_create_settings
from app.services import summaries


@respx.mock
def test_daily_summary_sent_when_enabled(auth_client, db_session):
    route = respx.post("https://n8n.example.com/webhook/test").mock(return_value=Response(200))
    cat = auth_client.post("/categories", json={"name": "Comida"}).json()
    auth_client.put(
        "/settings",
        json={
            "webhook_url": "https://n8n.example.com/webhook/test",
            "webhook_enabled": True,
            "summary_daily_enabled": True,
        },
    )
    auth_client.post(
        "/expenses",
        json={"amount_cents": 2500, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )

    db = db_session()
    try:
        settings = get_or_create_settings(db)
        summaries.send_daily_summary(db, settings, today=date(2026, 9, 19))
    finally:
        db.close()

    assert route.called
    logs = auth_client.get("/webhook-logs").json()
    daily = [l for l in logs if l["event_type"] == "summary.daily"]
    assert len(daily) == 1
    assert daily[0]["payload"]["data"]["total_cents"] == 2500


@respx.mock
def test_daily_summary_not_sent_when_disabled(auth_client, db_session):
    route = respx.post("https://n8n.example.com/webhook/test").mock(return_value=Response(200))
    auth_client.put(
        "/settings",
        json={"webhook_url": "https://n8n.example.com/webhook/test", "webhook_enabled": True},
    )
    db = db_session()
    try:
        settings = get_or_create_settings(db)
        summaries.send_daily_summary(db, settings, today=date(2026, 9, 19))
    finally:
        db.close()
    assert not route.called
