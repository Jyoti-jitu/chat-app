"""
2Factor SMS OTP Service for Indian Mobile Numbers.
Integrates with the official 2Factor REST API (https://2factor.in/API/V1/...).
Handles OTP dispatch, verification, rate limiting, cooldown, and attempt limits.
Never logs raw OTP codes or API keys.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx
import jwt
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.logging import logger
from shared.database.mongodb import db_manager


class TwoFactorService:
    """Manages 2Factor SMS OTP operations, session tracking, and verification."""

    @property
    def sessions_collection(self):
        """Returns the otp_sessions MongoDB collection."""
        db = db_manager.get_database()
        return db.otp_sessions

    @staticmethod
    def normalize_indian_phone(phone: str) -> str:
        """
        Normalizes phone number to 10-digit Indian mobile format.
        Validates format against standard Indian telecommunication rules (starts with 6, 7, 8, 9).
        """
        digits = "".join(c for c in phone if c.isdigit())
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]

        if len(digits) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid mobile number. Expected a 10-digit Indian mobile number, got '{phone}'.",
            )

        if digits[0] not in {"6", "7", "8", "9"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Indian mobile number. Must begin with 6, 7, 8, or 9.",
            )

        return digits

    async def send_otp(
        self, phone: str, purpose: str = "register", channel: str = "sms"
    ) -> Dict[str, Any]:
        """
        Sends OTP via 2Factor REST API (SMS or Voice Call).
        Enforces 30s resend cooldown and tracks session in MongoDB.
        """
        clean_phone = self.normalize_indian_phone(phone)
        delivery_channel = "voice" if channel.lower() == "voice" else "sms"
        now = datetime.now(timezone.utc)

        # Check for active session cooldown
        existing_session = await self.sessions_collection.find_one(
            {"phone": clean_phone, "is_verified": False},
            sort=[("created_at", -1)],
        )

        if existing_session and "resend_available_at" in existing_session:
            resend_time = existing_session["resend_available_at"]
            if resend_time.tzinfo is None:
                resend_time = resend_time.replace(tzinfo=timezone.utc)
            if now < resend_time:
                remaining_seconds = int((resend_time - now).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {remaining_seconds}s before requesting a new OTP.",
                )

        api_key = settings.TWO_FACTOR_API_KEY.strip()
        is_live_key = bool(api_key and api_key != "your_2factor_api_key_here")

        session_id: str
        mock_otp: Optional[str] = None

        if is_live_key:
            # Call live 2Factor.in API: SMS or VOICE route
            endpoint = "VOICE" if delivery_channel == "voice" else "SMS"
            url = f"{settings.TWO_FACTOR_BASE_URL}/{api_key}/{endpoint}/{clean_phone}/AUTOGEN"
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    response = await client.get(url)
                    data = response.json()

                if data.get("Status") != "Success":
                    error_details = data.get("Details", "OTP dispatch failed")
                    logger.error(f"2Factor API error response ({endpoint}): {error_details}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"2Factor {endpoint} gateway error: {error_details}",
                    )

                session_id = data["Details"]
                logger.info(f"2Factor {endpoint} OTP dispatched successfully to +91 {clean_phone[-4:]}")

            except httpx.RequestError as exc:
                logger.error(f"Network error calling 2Factor API: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not reach 2Factor gateway. Please try again later.",
                )
        else:
            # Development Mode: generates local dev session
            session_id = f"DEV-{uuid.uuid4().hex[:16]}"
            mock_otp = "123456"
            logger.info(
                f"[DEV MODE] 2Factor mock OTP '123456' active for +91{clean_phone} (session: {session_id})"
            )

        # Save session tracking document
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        resend_available_at = now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)

        session_doc = {
            "session_id": session_id,
            "phone": clean_phone,
            "purpose": purpose,
            "channel": delivery_channel,
            "attempts": 0,
            "is_verified": False,
            "mock_otp": mock_otp,
            "created_at": now,
            "expires_at": expires_at,
            "resend_available_at": resend_available_at,
        }

        await self.sessions_collection.insert_one(session_doc)

        msg_type = "Voice call placed" if delivery_channel == "voice" else "SMS OTP sent"
        return {
            "status": "ok",
            "message": f"{msg_type} to +91 {clean_phone[:2]}******{clean_phone[-2:]}",
            "session_id": session_id,
            "phone": f"+91{clean_phone}",
            "channel": delivery_channel,
            "expires_in": settings.OTP_EXPIRE_MINUTES * 60,
            "resend_cooldown": settings.OTP_RESEND_COOLDOWN_SECONDS,
        }

    async def verify_otp(self, session_id: str, otp: str, phone: str) -> Dict[str, Any]:
        """
        Verifies entered OTP against 2Factor REST API.
        Protects against brute force (max 5 attempts) and token expiration.
        """
        clean_phone = self.normalize_indian_phone(phone)
        clean_otp = otp.strip()
        now = datetime.now(timezone.utc)

        session = await self.sessions_collection.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OTP session not found or expired. Please request a new OTP.",
            )

        if session.get("phone") != clean_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number does not match the active OTP session.",
            )

        # Check expiration
        expires_at = session.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and now > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP code has expired. Please request a new code.",
            )

        # Check attempt limits
        attempts = session.get("attempts", 0)
        if attempts >= settings.OTP_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Maximum verification attempts exceeded. Please request a new OTP.",
            )

        # Increment attempts counter
        await self.sessions_collection.update_one(
            {"session_id": session_id},
            {"$inc": {"attempts": 1}},
        )

        api_key = settings.TWO_FACTOR_API_KEY.strip()
        is_live_key = bool(api_key and api_key != "your_2factor_api_key_here")

        if is_live_key:
            # Verify via 2Factor REST API (SMS or VOICE)
            endpoint = "VOICE" if session.get("channel") == "voice" else "SMS"
            url = f"{settings.TWO_FACTOR_BASE_URL}/{api_key}/{endpoint}/VERIFY/{session_id}/{clean_otp}"
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    response = await client.get(url)
                    data = response.json()

                if data.get("Status") != "Success" or data.get("Details") != "OTP Matched":
                    error_msg = data.get("Details", "OTP Mismatch")
                    if "Mismatch" in error_msg:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid OTP. Please check the code and try again.",
                        )
                    elif "Expired" in error_msg:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="OTP has expired. Please request a new OTP.",
                        )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Verification failed: {error_msg}",
                    )

            except httpx.RequestError as exc:
                logger.error(f"Error communicating with 2Factor: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Verification service unavailable. Please try again later.",
                )
        else:
            # Dev mock verification
            if clean_otp != "123456" and clean_otp != session.get("mock_otp"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid OTP code. In dev mode, use '123456'.",
                )

        # Mark session verified
        await self.sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {"is_verified": True, "verified_at": now}},
        )

        # Create signed proof token for registration
        verification_payload = {
            "sub": f"+91{clean_phone}",
            "phone": f"+91{clean_phone}",
            "purpose": "phone_verified",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
        }
        verification_token = jwt.encode(
            verification_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )

        logger.info(f"Phone +91{clean_phone} successfully verified via 2Factor.")

        return {
            "status": "ok",
            "message": "Mobile number verified successfully.",
            "phone": f"+91{clean_phone}",
            "verification_token": verification_token,
        }

    @staticmethod
    def verify_phone_token(token: str, expected_phone: str) -> bool:
        """Cryptographically verifies that the provided token confirms phone ownership."""
        if not token:
            return False
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
            return (
                payload.get("purpose") == "phone_verified"
                and payload.get("phone") == expected_phone
            )
        except Exception:
            return False


two_factor_service = TwoFactorService()
