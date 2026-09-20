def test_month_report_totals_and_pct(auth_client):
    cat = auth_client.post("/categories", json={"name": "Comida", "monthly_budget_cents": 10000}).json()
    auth_client.post(
        "/expenses",
        json={"amount_cents": 4000, "category_id": cat["id"], "spent_at": "2026-09-05"},
    )
    auth_client.post(
        "/expenses",
        json={"amount_cents": 1000, "category_id": cat["id"], "spent_at": "2026-09-10"},
    )
    # Gasto fuera de mes no debe contar
    auth_client.post(
        "/expenses",
        json={"amount_cents": 999999, "category_id": cat["id"], "spent_at": "2026-08-01"},
    )

    response = auth_client.get("/reports/month?month=2026-09")
    assert response.status_code == 200
    body = response.json()
    assert body["total_cents"] == 5000
    assert body["by_category"][0]["pct"] == 50.0


def test_month_report_invalid_month_format(auth_client):
    response = auth_client.get("/reports/month?month=septiembre")
    assert response.status_code == 400
