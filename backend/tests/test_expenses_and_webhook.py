import respx
from httpx import Response


@respx.mock
def test_creating_expense_sends_webhook_event(auth_client):
    route = respx.post("https://n8n.example.com/webhook/test").mock(
        return_value=Response(200, json={"ok": True})
    )
    cat = auth_client.post("/categories", json={"name": "Comida", "monthly_budget_cents": 100000}).json()
    auth_client.put(
        "/settings",
        json={"webhook_url": "https://n8n.example.com/webhook/test", "webhook_enabled": True},
    )

    response = auth_client.post(
        "/expenses",
        json={
            "amount_cents": 5000,
            "category_id": cat["id"],
            "description": "Almuerzo",
            "spent_at": "2026-09-19",
        },
    )
    assert response.status_code == 201
    assert route.called

    logs = auth_client.get("/webhook-logs").json()
    events = [log["event_type"] for log in logs]
    assert "expense.created" in events


@respx.mock
def test_no_webhook_call_when_disabled(auth_client):
    route = respx.post("https://n8n.example.com/webhook/test").mock(return_value=Response(200))
    cat = auth_client.post("/categories", json={"name": "Ocio"}).json()

    response = auth_client.post(
        "/expenses",
        json={"amount_cents": 1000, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    assert response.status_code == 201
    assert not route.called
    assert auth_client.get("/webhook-logs").json() == []


@respx.mock
def test_budget_threshold_fires_once_per_month(auth_client):
    respx.post("https://n8n.example.com/webhook/test").mock(return_value=Response(200))
    cat = auth_client.post("/categories", json={"name": "Comida", "monthly_budget_cents": 10000}).json()
    auth_client.put(
        "/settings",
        json={
            "webhook_url": "https://n8n.example.com/webhook/test",
            "webhook_enabled": True,
            "budget_thresholds": "80,100",
        },
    )

    # 85% del presupuesto -> debe disparar el umbral 80
    auth_client.post(
        "/expenses",
        json={"amount_cents": 8500, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    logs = auth_client.get("/webhook-logs").json()
    threshold_events = [l for l in logs if l["event_type"] == "budget.threshold"]
    assert len(threshold_events) == 1
    assert threshold_events[0]["payload"]["data"]["threshold_pct"] == 80

    # Otro gasto pequeño que sigue sobre 80% pero no llega a 100%: no debe repetir el 80
    auth_client.post(
        "/expenses",
        json={"amount_cents": 100, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    logs = auth_client.get("/webhook-logs").json()
    threshold_events = [l for l in logs if l["event_type"] == "budget.threshold"]
    assert len(threshold_events) == 1  # sigue siendo 1, no se duplicó

    # Gasto que cruza 100%
    auth_client.post(
        "/expenses",
        json={"amount_cents": 2000, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    logs = auth_client.get("/webhook-logs").json()
    threshold_events = [l for l in logs if l["event_type"] == "budget.threshold"]
    assert sorted(e["payload"]["data"]["threshold_pct"] for e in threshold_events) == [80, 100]


@respx.mock
def test_webhook_test_uses_unsaved_form_values_and_ignores_enabled_flag(auth_client):
    """Regresión: el botón "Probar webhook" debe probar la URL/header tal como
    están en el formulario aunque el usuario no haya guardado todavía y aunque
    "Habilitar envío al webhook" siga apagado (settings por defecto: sin URL,
    webhook_enabled=False)."""
    route = respx.post("https://n8n.example.com/webhook/unsaved").mock(return_value=Response(200))

    response = auth_client.post(
        "/settings/webhook/test",
        json={
            "webhook_url": "https://n8n.example.com/webhook/unsaved",
            "webhook_header_name": "X-Webhook-Token",
            "webhook_header_value": "secret123",
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert route.called
    assert route.calls.last.request.headers["X-Webhook-Token"] == "secret123"

    # Los settings guardados NO deben haberse modificado por el test.
    saved = auth_client.get("/settings").json()
    assert saved["webhook_url"] is None
    assert saved["webhook_enabled"] is False


@respx.mock
def test_webhook_test_endpoint_reports_failure(auth_client):
    respx.post("https://n8n.example.com/webhook/test").mock(return_value=Response(500, text="boom"))
    auth_client.put(
        "/settings",
        json={"webhook_url": "https://n8n.example.com/webhook/test", "webhook_enabled": True},
    )
    response = auth_client.post("/settings/webhook/test")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["status_code"] == 500


def test_webhook_test_without_url_configured(auth_client):
    response = auth_client.post("/settings/webhook/test")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["error"] is not None


@respx.mock
def test_retry_webhook_log(auth_client):
    # send_event ya reintenta MAX_ATTEMPTS veces internamente, así que para que
    # el envío inicial quede registrado como fallido deben fallar TODOS esos
    # intentos; recién la llamada de /retry (una llamada más) debe tener éxito.
    route = respx.post("https://n8n.example.com/webhook/test").mock(
        side_effect=[Response(500), Response(500), Response(500), Response(200)]
    )
    cat = auth_client.post("/categories", json={"name": "Comida"}).json()
    auth_client.put(
        "/settings",
        json={"webhook_url": "https://n8n.example.com/webhook/test", "webhook_enabled": True},
    )
    auth_client.post(
        "/expenses",
        json={"amount_cents": 1000, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    logs = auth_client.get("/webhook-logs").json()
    failed_log = next(l for l in logs if l["event_type"] == "expense.created")
    assert failed_log["success"] is False

    retry_response = auth_client.post(f"/webhook-logs/{failed_log['id']}/retry")
    assert retry_response.status_code == 200
    assert retry_response.json()["success"] is True
