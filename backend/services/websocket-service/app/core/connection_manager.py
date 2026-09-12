"""
Connection Manager for WebSocket Service.
Maintains user-to-socket registry supporting multiple active devices/browser tabs per user,
thread-safe broadcasting, and automatic online/offline presence updates.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("FluxChat.WebSocketService.ConnectionManager")


class ConnectionManager:
    """Manages active WebSocket connections and multiplexes messaging."""

    def __init__(self):
        # Maps user_id -> Set of active WebSocket instances
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        """
        Registers a new WebSocket connection for the given user.
        Returns True if this is the user's first active connection (offline -> online transition).
        """
        async with self._lock:
            first_connection = False
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
                first_connection = True
            self.active_connections[user_id].add(websocket)
            logger.info(
                f"User [{user_id}] connected via WebSocket. (Total user sockets: {len(self.active_connections[user_id])})"
            )
            return first_connection

    async def disconnect(self, user_id: str, websocket: WebSocket) -> bool:
        """
        Removes a WebSocket connection.
        Returns True if the user has no remaining active connections (online -> offline transition).
        """
        async with self._lock:
            last_connection = False
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    last_connection = True
            logger.info(
                f"User [{user_id}] disconnected. Still active: {not last_connection}"
            )
            return last_connection

    async def send_personal_message(self, message: dict, user_id: str) -> None:
        """Sends a JSON frame to all active sockets belonging to the target user."""
        sockets = list(self.active_connections.get(user_id, set()))
        if not sockets:
            return

        dead_sockets = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending frame to user [{user_id}] socket: {e}")
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                if user_id in self.active_connections:
                    for dead in dead_sockets:
                        self.active_connections[user_id].discard(dead)
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]

    async def broadcast_to_users(
        self,
        message: dict,
        user_ids: List[str],
        exclude_user_id: Optional[str] = None,
    ) -> None:
        """Broadcasts a JSON frame to a specific list of user IDs."""
        tasks = []
        for uid in user_ids:
            if exclude_user_id and uid == exclude_user_id:
                continue
            if uid in self.active_connections:
                tasks.append(self.send_personal_message(message, uid))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_all(
        self, message: dict, exclude_user_id: Optional[str] = None
    ) -> None:
        """Broadcasts a JSON frame to all connected users across the service."""
        user_ids = list(self.active_connections.keys())
        await self.broadcast_to_users(
            message, user_ids, exclude_user_id=exclude_user_id
        )

    def is_user_online(self, user_id: str) -> bool:
        """Returns True if user has at least one active WebSocket connection."""
        return user_id in self.active_connections and bool(
            self.active_connections[user_id]
        )

    def get_online_users(self) -> List[str]:
        """Returns a list of all currently connected user IDs."""
        return list(self.active_connections.keys())

    def get_connection_count(self) -> int:
        """Returns total active socket count across all connected users."""
        return sum(len(sockets) for sockets in self.active_connections.values())

    def get_user_count(self) -> int:
        """Returns total unique active user count."""
        return len(self.active_connections)


connection_manager = ConnectionManager()
