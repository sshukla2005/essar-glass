import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_session_lock_flow(db_session):
    # Create test user
    username = f"test_session_user_{uuid.uuid4().hex[:6]}"
    password = "password123"
    hashed_pwd = hash_password(password)

    user = User(
        username=username,
        password=hashed_pwd,
        name="Session Test User",
        role="sales",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 1. First login should succeed
    login_res1 = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password}
    )
    assert login_res1.status_code == 200
    token1 = login_res1.json()["access_token"]
    assert token1 is not None

    db_session.refresh(user)
    assert user.current_session_id is not None
    assert user.session_started_at is not None

    # 2. Second login attempt should be blocked with 409 CONFLICT
    login_res2 = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password}
    )
    assert login_res2.status_code == 409
    assert "already logged in" in login_res2.json()["detail"]

    # 3. User logs out with session token
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert logout_res.status_code == 200
    assert logout_res.json() == {"ok": True}

    db_session.refresh(user)
    assert user.current_session_id is None
    assert user.session_started_at is None

    # 4. Login after logout should now succeed
    login_res3 = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password}
    )
    assert login_res3.status_code == 200
    token3 = login_res3.json()["access_token"]

    # 5. Accessing API with old logged-out token (token1) should fail with 401
    auth_check_old = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert auth_check_old.status_code == 401
    assert "Session ended" in auth_check_old.json()["detail"]


def test_force_logout(db_session):
    # Create superadmin and regular user
    superadmin = User(
        username=f"super_{uuid.uuid4().hex[:6]}",
        password=hash_password("pass"),
        name="Super User",
        role="superadmin",
        is_active=True
    )
    target = User(
        username=f"target_{uuid.uuid4().hex[:6]}",
        password=hash_password("pass"),
        name="Target User",
        role="sales",
        is_active=True
    )
    db_session.add_all([superadmin, target])
    db_session.commit()
    db_session.refresh(superadmin)
    db_session.refresh(target)

    # Login both
    s_token = client.post("/api/v1/auth/login", data={"username": superadmin.username, "password": "pass"}).json()["access_token"]
    t_token = client.post("/api/v1/auth/login", data={"username": target.username, "password": "pass"}).json()["access_token"]

    # Superadmin force logouts target user
    force_res = client.post(
        f"/api/v1/users/{target.id}/force-logout",
        headers={"Authorization": f"Bearer {s_token}"}
    )
    assert force_res.status_code == 200

    # Target user session is now invalidated
    check_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert check_res.status_code == 401
