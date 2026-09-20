def test_create_and_list_category(auth_client):
    response = auth_client.post(
        "/categories",
        json={"name": "Comida", "color": "#f97316", "icon": "utensils", "monthly_budget_cents": 50000},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Comida"
    assert body["is_active"] is True

    response = auth_client.get("/categories")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_duplicate_category_name_rejected(auth_client):
    auth_client.post("/categories", json={"name": "Comida"})
    response = auth_client.post("/categories", json={"name": "Comida"})
    assert response.status_code == 409


def test_update_category(auth_client):
    created = auth_client.post("/categories", json={"name": "Ocio"}).json()
    response = auth_client.patch(f"/categories/{created['id']}", json={"monthly_budget_cents": 20000})
    assert response.status_code == 200
    assert response.json()["monthly_budget_cents"] == 20000


def test_delete_category_without_expenses_removes_it(auth_client):
    created = auth_client.post("/categories", json={"name": "Transporte"}).json()
    response = auth_client.delete(f"/categories/{created['id']}")
    assert response.status_code == 204
    assert auth_client.get("/categories").json() == []


def test_delete_category_with_expenses_deactivates_it(auth_client):
    cat = auth_client.post("/categories", json={"name": "Salud"}).json()
    auth_client.post(
        "/expenses",
        json={"amount_cents": 1000, "category_id": cat["id"], "spent_at": "2026-09-19"},
    )
    response = auth_client.delete(f"/categories/{cat['id']}")
    assert response.status_code == 204
    assert auth_client.get("/categories").json() == []
    assert auth_client.get("/categories?include_inactive=true").json()[0]["is_active"] is False
