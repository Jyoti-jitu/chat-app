import time
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.services.two_factor_service import two_factor_service
from shared.database.mongodb import db_manager


@pytest_asyncio.fixture(autouse=True)
async def db_lifecycle():
    """Ensure database connection is active during test execution."""
    await db_manager.connect(settings.MONGODB_URL, settings.MONGODB_DATABASE)
    yield
    await db_manager.disconnect()


@pytest.mark.asyncio
async def test_normalize_indian_phone():
    """Test normalization and validation of Indian phone numbers."""
    assert two_factor_service.normalize_indian_phone("+919876543210") == "9876543210"
    assert two_factor_service.normalize_indian_phone("919876543210") == "9876543210"
    assert two_factor_service.normalize_indian_phone("98765 43210") == "9876543210"
    assert two_factor_service.normalize_indian_phone("09876543210") == "9876543210"

    with pytest.raises(Exception):
        two_factor_service.normalize_indian_phone("12345")  # Too short

    with pytest.raises(Exception):
        two_factor_service.normalize_indian_phone("1234567890")  # Does not start with 6,7,8,9


@pytest.mark.asyncio
async def test_two_factor_registration_and_login(monkeypatch):
    """End-to-end test of 2Factor SMS OTP send, verify, registration, and OTP login."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "TWO_FACTOR_API_KEY", "")

    test_suffix = int(time.time() * 1000)
    phone_digits = f"98{str(test_suffix)[-8:]}"
    full_phone = f"+91{phone_digits}"
    email = f"otp_user_{test_suffix}@example.com"
    username = f"otpuser_{test_suffix}"
    password = "SecurePassword123!"

    db = db_manager.get_database()
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Send OTP for registration
            send_resp = await ac.post(
                "/auth/send-otp",
                json={"phone": full_phone, "purpose": "register"},
            )
            assert send_resp.status_code == 200
            send_data = send_resp.json()
            assert "session_id" in send_data
            session_id = send_data["session_id"]
            assert send_data["resend_cooldown"] == 30

            # 2. Resending immediately triggers 429 rate limit cooldown
            rate_limit_resp = await ac.post(
                "/auth/send-otp",
                json={"phone": full_phone, "purpose": "register"},
            )
            assert rate_limit_resp.status_code == 429

            # 3. Verify with wrong OTP fails (400)
            bad_verify = await ac.post(
                "/auth/verify-otp",
                json={"session_id": session_id, "otp": "000000", "phone": full_phone},
            )
            assert bad_verify.status_code == 400

            # 4. Verify with valid dev OTP (123456)
            good_verify = await ac.post(
                "/auth/verify-otp",
                json={"session_id": session_id, "otp": "123456", "phone": full_phone},
            )
            assert good_verify.status_code == 200
            verify_data = good_verify.json()
            assert "verification_token" in verify_data
            verification_token = verify_data["verification_token"]

            # 5. Complete registration using verified phone
            reg_resp = await ac.post(
                "/auth/register",
                json={
                    "name": "OTP Verified User",
                    "username": username,
                    "email": email,
                    "password": password,
                    "phone": full_phone,
                    "verification_token": verification_token,
                },
            )
            assert reg_resp.status_code == 201
            reg_data = reg_resp.json()
            assert reg_data["user"]["phone"] == full_phone

            # 6. Test Mobile OTP Login for the created user
            login_send_resp = await ac.post(
                "/auth/send-otp",
                json={"phone": full_phone, "purpose": "login"},
            )
            # If still in 30s cooldown from earlier session, clear session cooldown for test
            if login_send_resp.status_code == 429:
                await db.otp_sessions.delete_many({"phone": phone_digits})
                login_send_resp = await ac.post(
                    "/auth/send-otp",
                    json={"phone": full_phone, "purpose": "login"},
                )

            assert login_send_resp.status_code == 200
            login_session_id = login_send_resp.json()["session_id"]

            # 7. Perform OTP Login
            login_otp_resp = await ac.post(
                "/auth/login-otp",
                json={
                    "session_id": login_session_id,
                    "otp": "123456",
                    "phone": full_phone,
                },
            )
            assert login_otp_resp.status_code == 200
            login_data = login_otp_resp.json()
            assert "access_token" in login_data
            assert login_data["user"]["username"] == username

    finally:
        # Clean up test user & OTP sessions
        await db.users.delete_one({"email": email})
        await db.otp_sessions.delete_many({"phone": phone_digits})
