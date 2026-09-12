import time
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import PasswordHasher
from app.core.jwt import JWTService
from app.core.config import settings
from shared.database.mongodb import db_manager


@pytest_asyncio.fixture(autouse=True)
async def db_lifecycle():
    """Ensure database connection is active during test execution."""
    await db_manager.connect(settings.MONGODB_URL, settings.MONGODB_DATABASE)
    yield
    await db_manager.disconnect()


def test_password_hasher():
    """Test bcrypt password hashing and verification."""
    password = "SuperSecretPassword123!"
    hashed = PasswordHasher.hash_password(password)

    assert hashed != password
    assert PasswordHasher.verify_password(password, hashed) is True
    assert PasswordHasher.verify_password("WrongPassword!", hashed) is False
    assert PasswordHasher.verify_password("", hashed) is False


def test_jwt_service():
    """Test JWT token issuance and decoding."""
    user_id = "507f1f77bcf86cd799439011"
    email = "test@fluxchat.internal"
    username = "jwtuser"

    access_token = JWTService.create_access_token(user_id=user_id, email=email, username=username)
    payload = JWTService.decode_token(access_token)
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["username"] == username
    assert payload["type"] == "access"

    refresh_token = JWTService.create_refresh_token(user_id=user_id)
    r_payload = JWTService.decode_token(refresh_token)
    assert r_payload["sub"] == user_id
    assert r_payload["type"] == "refresh"


@pytest.mark.asyncio
async def test_auth_full_lifecycle():
    """Test end-to-end user registration, login, profile retrieval, refresh, and logout."""
    test_suffix = int(time.time() * 1000)
    email = f"testuser_{test_suffix}@example.com"
    username = f"user_{test_suffix}"
    password = "SecurePassword123!"

    db = db_manager.get_database()
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Register new user
            reg_payload = {
                "name": "Test User",
                "username": username,
                "email": email,
                "password": password,
            }
            reg_resp = await ac.post("/auth/register", json=reg_payload)
            assert reg_resp.status_code == 201
            reg_data = reg_resp.json()
            assert "access_token" in reg_data
            assert "refresh_token" in reg_data
            assert reg_data["user"]["email"] == email
            assert reg_data["user"]["username"] == username
            assert "password_hash" not in reg_data["user"]
            assert isinstance(reg_data["user"]["id"], str)

            access_token = reg_data["access_token"]
            refresh_token = reg_data["refresh_token"]

            # 2. Duplicate registration should fail (Conflict 409)
            dup_resp = await ac.post("/auth/register", json=reg_payload)
            assert dup_resp.status_code == 409

            # 3. Login with email
            login_resp = await ac.post("/auth/login", json={"email": email, "password": password})
            assert login_resp.status_code == 200
            assert "access_token" in login_resp.json()

            # 4. Login with username
            login_user_resp = await ac.post(
                "/auth/login", json={"username": username, "password": password}
            )
            assert login_user_resp.status_code == 200

            # 5. Login with invalid password fails (401)
            bad_login = await ac.post(
                "/auth/login", json={"email": email, "password": "WrongPassword!"}
            )
            assert bad_login.status_code == 401

            # 6. Access current user profile via GET /auth/me
            headers = {"Authorization": f"Bearer {access_token}"}
            me_resp = await ac.get("/auth/me", headers=headers)
            assert me_resp.status_code == 200
            me_data = me_resp.json()
            assert me_data["email"] == email
            assert me_data["username"] == username

            # 7. Access /auth/me without token fails (401)
            unauth_resp = await ac.get("/auth/me")
            assert unauth_resp.status_code == 401

            # 8. Refresh token via POST /auth/refresh
            refresh_resp = await ac.post(
                "/auth/refresh", json={"refresh_token": refresh_token}
            )
            assert refresh_resp.status_code == 200
            new_tokens = refresh_resp.json()
            assert "access_token" in new_tokens
            assert "refresh_token" in new_tokens
            new_access_token = new_tokens["access_token"]

            # 9. Verify token rotation: old refresh token should now be revoked
            old_refresh_reuse = await ac.post(
                "/auth/refresh", json={"refresh_token": refresh_token}
            )
            assert old_refresh_reuse.status_code == 401

            # 10. Logout using new access token
            logout_resp = await ac.post(
                "/auth/logout", headers={"Authorization": f"Bearer {new_access_token}"}
            )
            assert logout_resp.status_code == 200

            # 11. Logged out access token can no longer access /auth/me
            logged_out_me = await ac.get(
                "/auth/me", headers={"Authorization": f"Bearer {new_access_token}"}
            )
            assert logged_out_me.status_code == 401

    finally:
        # Clean up created test user from database
        await db.users.delete_one({"email": email})
