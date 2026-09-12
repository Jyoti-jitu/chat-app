"""
Cursor-based pagination utilities for opaque Base64 URL-safe token serialization.
Encodes (timestamp, object_id) tuples to prevent query drift and deep offset degradation.
"""
import base64
from datetime import datetime, timezone
import json
from typing import Optional, Tuple
from fastapi import HTTPException, status


def encode_cursor(created_at: datetime, item_id: str) -> str:
    """
    Serializes a datetime and item ID into a URL-safe Base64 opaque cursor token.
    """
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    payload = {
        "t": created_at.isoformat(),
        "id": str(item_id),
    }
    json_bytes = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(json_bytes).decode("utf-8").rstrip("=")


def decode_cursor(cursor_token: str) -> Tuple[datetime, str]:
    """
    Decodes a URL-safe Base64 token into (created_at, item_id).
    Raises HTTP 400 if the cursor format is invalid or corrupted.
    """
    if not cursor_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cursor cannot be empty.",
        )

    try:
        # Add back padding if missing
        padding = 4 - (len(cursor_token) % 4)
        if padding != 4:
            cursor_token += "=" * padding

        decoded_bytes = base64.urlsafe_b64decode(cursor_token.encode("utf-8"))
        data = json.loads(decoded_bytes.decode("utf-8"))

        iso_str = data["t"]
        item_id = data["id"]
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt, str(item_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pagination cursor provided.",
        )
