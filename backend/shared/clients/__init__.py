"""Shared Inter-Service RPC Client Package (Phase 20)."""
from .service_client import (
    ServiceClient,
    get_auth_client,
    get_chat_client,
    get_message_client,
    get_notification_client,
    get_user_client,
)

__all__ = [
    "ServiceClient",
    "get_auth_client",
    "get_chat_client",
    "get_message_client",
    "get_notification_client",
    "get_user_client",
]
