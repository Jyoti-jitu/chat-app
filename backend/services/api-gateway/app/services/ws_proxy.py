"""
WebSocket reverse proxy / tunneling service.
"""
import asyncio
from typing import Optional
from starlette.websockets import WebSocket, WebSocketDisconnect
import websockets
from app.core.config import settings
from app.core.logging import logger


async def proxy_websocket(client_ws: WebSocket, subpath: str = "/ws") -> None:
    """
    Tunnels WebSocket traffic bidirectionally between client and upstream WebSocket service.
    """
    await client_ws.accept()

    # Form upstream URL with original query string
    query_str = client_ws.scope.get("query_string", b"").decode("utf-8")
    upstream_base = settings.WS_SERVICE_URL.rstrip("/")
    if upstream_base.startswith("http://"):
        upstream_base = "ws://" + upstream_base[7:]
    elif upstream_base.startswith("https://"):
        upstream_base = "wss://" + upstream_base[8:]

    # ensure subpath matches upstream route (websocket service listens on /ws)
    target_path = "/ws"
    upstream_url = f"{upstream_base}{target_path}"
    if query_str:
        upstream_url = f"{upstream_url}?{query_str}"

    upstream_ws: Optional[websockets.WebSocketClientProtocol] = None

    try:
        upstream_ws = await websockets.connect(upstream_url)
    except (
        websockets.exceptions.InvalidStatus,
        websockets.exceptions.InvalidStatusCode,
        websockets.exceptions.InvalidHandshake,
    ) as exc:
        status_code = getattr(exc, "status_code", None)
        if status_code is None and hasattr(exc, "response"):
            status_code = getattr(exc.response, "status_code", None)
        logger.warning(f"Upstream WS rejected connection with status {status_code or exc}")
        await client_ws.close(code=1008, reason="Policy Violation")
        return
    except websockets.exceptions.ConnectionClosed as exc:
        logger.warning(f"Upstream WS closed connection immediately: {exc.code} {exc.reason}")
        await client_ws.close(code=exc.code or 1008, reason=exc.reason or "Policy Violation")
        return
    except Exception as exc:
        logger.error(f"Failed to connect to upstream WS service at {upstream_url}: {exc}")
        await client_ws.close(code=1011, reason="Upstream gateway error")
        return


    async def client_to_upstream():
        try:
            while True:
                msg = await client_ws.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if "text" in msg and msg["text"] is not None:
                    await upstream_ws.send(msg["text"])
                elif "bytes" in msg and msg["bytes"] is not None:
                    await upstream_ws.send(msg["bytes"])
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as e:
            logger.debug(f"Client to upstream error: {e}")

    async def upstream_to_client():
        try:
            while True:
                data = await upstream_ws.recv()
                if isinstance(data, str):
                    await client_ws.send_text(data)
                elif isinstance(data, (bytes, bytearray)):
                    await client_ws.send_bytes(data)
        except (websockets.exceptions.ConnectionClosed, asyncio.CancelledError):
            pass
        except Exception as e:
            logger.debug(f"Upstream to client error: {e}")

    # Run tasks until either side disconnects
    t_client = asyncio.create_task(client_to_upstream())
    t_upstream = asyncio.create_task(upstream_to_client())

    done, pending = await asyncio.wait(
        [t_client, t_upstream],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    # Clean close upstream
    try:
        if upstream_ws:
            await upstream_ws.close()
    except Exception:
        pass

    # Clean close client
    try:
        await client_ws.close()
    except Exception:
        pass
