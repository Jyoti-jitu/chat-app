"""
Security and password hashing utilities.
Uses bcrypt to hash and verify passwords securely.
Plaintext passwords are NEVER stored or logged.
"""
import bcrypt
from app.core.logging import logger


class PasswordHasher:
    """Handles password hashing and verification using bcrypt."""

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hashes a plaintext password using bcrypt with a secure work factor (12 rounds).
        Truncates at 72 bytes as per bcrypt specification.
        """
        if not password:
            raise ValueError("Password cannot be empty.")
        password_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verifies a plaintext password against a stored bcrypt hash.
        Returns False if verification fails or an exception occurs.
        """
        if not plain_password or not hashed_password:
            return False
        try:
            password_bytes = plain_password.encode("utf-8")[:72]
            hashed_bytes = hashed_password.encode("utf-8")
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception as e:
            logger.warning(f"Password verification error: {e}")
            return False
