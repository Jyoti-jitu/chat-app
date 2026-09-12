"""
WebSocket Route & REST Event Broadcasting Bridge for FluxChat.
Handles real-time socket connections with JWT handshake authentication,
typing indicator relays, presence tracking, and cross-service broadcast dispatching.
"""
import json
import logging
import time
from typing import Any, Dict, Optional
from bson import ObjectId
import jwt
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from app.core.config import settings
from app.core.connection_manager import connection_manager
from app.schemas.events import (
    BroadcastEventPayload,
    OnlinePresenceResponse,
    UserPresenceResponse,
    WebSocketEvent,
)
from shared.database.mongodb import db_manager

logger = logging.getLogger("FluxChat.WebSocketService.WebSockets")

router = APIRouter(tags=["WebSockets"])


async def authenticate_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Validates JWT token for WebSocket connection.
    Verifies signature, expiration, access type, revocation status, and active user.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except Exception as e:
        logger.warning(f"WebSocket handshake token decode failed: {e}")
        return None

    # Enforce access token type
    if payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        return None

    # Verify token is not revoked and user exists & is active
    if await db_manager.is_connected():
        try:
            db = db_manager.get_database()
            is_revoked = await db.revoked_tokens.find_one({"token": token})
            if is_revoked:
                return None

            user_doc = await db.users.find_one(
                {"_id": ObjectId(user_id), "is_active": True}
            )
            if not user_doc:
                return None
        except Exception as db_err:
            logger.error(f"Error validating user session in DB: {db_err}")

    return payload


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    Bidirectional WebSocket endpoint for FluxChat real-time messaging.
    Requires a valid JWT access token passed via query param (?token=<jwt>).
    """
    # 1. Authenticate during Handshake
    payload = await authenticate_token(token)
    if not payload:
        logger.warning("Rejected unauthenticated WebSocket handshake request.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Accept connection and extract identity
    await websocket.accept()
    user_id = str(payload.get("sub"))
    first_connection = await connection_manager.connect(user_id, websocket)

    # 3. Update database presence if transitioning from offline -> online
    if first_connection and await db_manager.is_connected():
        try:
            db = db_manager.get_database()
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_online": True}},
            )
            # Broadcast user.online to all connected clients
            online_event = {
                "event": "user.online",
                "data": {"user_id": user_id},
                "timestamp": int(time.time()),
            }
            await connection_manager.broadcast_to_all(
                online_event, exclude_user_id=user_id
            )
        except Exception as e:
            logger.warning(f"Failed to record online status in DB: {e}")

    # 4. Send connection ACK
    ack_event = {
        "event": "connection.ack",
        "data": {
            "user_id": user_id,
            "online_users": connection_manager.get_online_users(),
        },
        "timestamp": int(time.time()),
    }
    await websocket.send_json(ack_event)

    # 5. Receive & Dispatch Event Loop
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                frame = json.loads(raw_text)
            except Exception:
                continue

            event_name = frame.get("event")
            data = frame.get("data", {})

            # Heartbeat ping/pong
            if event_name == "ping":
                await websocket.send_json(
                    {
                        "event": "pong",
                        "data": {},
                        "timestamp": int(time.time()),
                    }
                )

            # Ephemeral typing indicators
            elif event_name in ("typing.start", "typing.stop"):
                conversation_id = data.get("conversation_id")
                recipient_ids = data.get("recipient_ids")

                typing_payload = {
                    "event": event_name,
                    "data": {
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                    },
                    "timestamp": int(time.time()),
                }

                if recipient_ids and isinstance(recipient_ids, list):
                    await connection_manager.broadcast_to_users(
                        typing_payload, recipient_ids, exclude_user_id=user_id
                    )
                elif conversation_id and await db_manager.is_connected():
                    try:
                        db = db_manager.get_database()
                        conv = await db.conversations.find_one(
                            {"_id": ObjectId(conversation_id)}
                        )
                        if conv:
                            members = [str(m) for m in conv.get("members", [])]
                            await connection_manager.broadcast_to_users(
                                typing_payload, members, exclude_user_id=user_id
                            )
                    except Exception as e:
                        logger.warning(f"Error querying conversation members: {e}")

            # Message read receipt relay
            elif event_name == "message.read":
                conversation_id = data.get("conversation_id")
                message_id = data.get("message_id")
                recipient_ids = data.get("recipient_ids")

                read_payload = {
                    "event": "message.read",
                    "data": {
                        "conversation_id": conversation_id,
                        "message_id": message_id,
                        "reader_id": user_id,
                    },
                    "timestamp": int(time.time()),
                }

                if recipient_ids and isinstance(recipient_ids, list):
                    await connection_manager.broadcast_to_users(
                        read_payload, recipient_ids, exclude_user_id=user_id
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected cleanly: user [{user_id}]")
    except Exception as exc:
        logger.warning(f"WebSocket connection error for user [{user_id}]: {exc}")
    finally:
        # 6. Disconnect socket and evaluate offline status
        last_connection = await connection_manager.disconnect(user_id, websocket)
        if last_connection and await db_manager.is_connected():
            try:
                db = db_manager.get_database()
                now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"is_online": False, "last_seen": now_str}},
                )
                offline_event = {
                    "event": "user.offline",
                    "data": {"user_id": user_id, "last_seen": now_str},
                    "timestamp": int(time.time()),
                }
                await connection_manager.broadcast_to_all(
                    offline_event, exclude_user_id=user_id
                )
            except Exception as e:
                logger.warning(f"Failed to record offline status in DB: {e}")


# ==============================================================================
# REST Bridge Routes for Microservice Event Broadcasting & Presence Checks
# ==============================================================================


@router.post(
    "/events/broadcast",
    status_code=status.HTTP_200_OK,
    summary="Broadcast Event to Connected Users",
    description="Internal REST endpoint for microservices to broadcast real-time events.",
)
async def broadcast_event(payload: BroadcastEventPayload):
    """Dispatches a real-time event frame to targeted or all connected users."""
    event_frame = {
        "event": payload.event,
        "data": payload.data,
        "timestamp": int(time.time()),
    }

    if payload.recipient_ids is not None:
        await connection_manager.broadcast_to_users(
            event_frame,
            payload.recipient_ids,
            exclude_user_id=payload.exclude_user_id,
        )
        recipients_count = len(payload.recipient_ids)
    else:
        await connection_manager.broadcast_to_all(
            event_frame, exclude_user_id=payload.exclude_user_id
        )
        recipients_count = connection_manager.get_user_count()

    return {
        "status": "delivered",
        "event": payload.event,
        "recipients_targeted": recipients_count,
    }


@router.get(
    "/presence/online",
    response_model=OnlinePresenceResponse,
    status_code=status.HTTP_200_OK,
    summary="List Currently Online Users",
)
async def get_online_users():
    """Returns list and counts of currently active online users."""
    online = connection_manager.get_online_users()
    return OnlinePresenceResponse(
        online_users=online,
        total_online=len(online),
        total_connections=connection_manager.get_connection_count(),
    )


@router.get(
    "/presence/{user_id}",
    response_model=UserPresenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Check User Online Status",
)
async def check_user_presence(user_id: str):
    """Returns whether a specific user is currently connected via WebSocket."""
    return UserPresenceResponse(
        user_id=user_id,
        is_online=connection_manager.is_user_online(user_id),
    )
