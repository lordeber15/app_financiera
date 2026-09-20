def test_login_wrong_password(client):
    response = client.post("/auth/login", json={"password": "incorrecta"})
    assert response.status_code == 401


def test_login_correct_password(client):
    response = client.post("/auth/login", json={"password": "test-password"})
    assert response.status_code == 200
    assert "session" in response.cookies


def test_protected_route_requires_auth(client):
    response = client.get("/categories")
    assert response.status_code == 401


def test_me_after_login(auth_client):
    response = auth_client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["authenticated"] is True


def test_logout_clears_session(auth_client):
    response = auth_client.post("/auth/logout")
    assert response.status_code == 200
    response = auth_client.get("/categories")
    assert response.status_code == 401
