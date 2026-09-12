"""
API Gateway v1 Router.
Maps prefixes to downstream microservices.
"""
from fastapi import APIRouter
from starlette.requests import Request
from app.core.config import settings
from app.services.http_proxy import proxy_request
from app.api.v1.health import router as health_router
from app.api.v1.docs import docs_router

api_router = APIRouter()

# Attach health and documentation routes
api_router.include_router(health_router, tags=["health"])
api_router.include_router(docs_router)


METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]

# WS HTTP base
ws_http_base = settings.WS_SERVICE_URL.replace("ws://", "http://").replace("wss://", "https://")


@api_router.api_route("/auth", methods=METHODS)
@api_router.api_route("/auth/{subpath:path}", methods=METHODS)
async def proxy_auth(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.AUTH_SERVICE_URL)


@api_router.api_route("/users", methods=METHODS)
@api_router.api_route("/users/{subpath:path}", methods=METHODS)
async def proxy_users(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.USER_SERVICE_URL)


@api_router.api_route("/contacts", methods=METHODS)
@api_router.api_route("/contacts/{subpath:path}", methods=METHODS)
async def proxy_contacts(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.USER_SERVICE_URL)


@api_router.api_route("/conversations/{conversation_id}/messages", methods=METHODS)
@api_router.api_route("/conversations/{conversation_id}/messages/{subpath:path}", methods=METHODS)
async def proxy_conversation_messages(request: Request, conversation_id: str, subpath: str = ""):
    return await proxy_request(request, settings.MESSAGE_SERVICE_URL)


@api_router.api_route("/conversations", methods=METHODS)
@api_router.api_route("/conversations/{subpath:path}", methods=METHODS)
async def proxy_conversations(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.CHAT_SERVICE_URL)



@api_router.api_route("/messages", methods=METHODS)
@api_router.api_route("/messages/{subpath:path}", methods=METHODS)
async def proxy_messages(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.MESSAGE_SERVICE_URL)


@api_router.api_route("/notifications", methods=METHODS)
@api_router.api_route("/notifications/{subpath:path}", methods=METHODS)
async def proxy_notifications(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.NOTIFICATION_SERVICE_URL)


@api_router.api_route("/presence", methods=METHODS)
@api_router.api_route("/presence/{subpath:path}", methods=METHODS)
async def proxy_presence(request: Request, subpath: str = ""):
    return await proxy_request(request, ws_http_base)


@api_router.api_route("/events", methods=METHODS)
@api_router.api_route("/events/{subpath:path}", methods=METHODS)
async def proxy_events(request: Request, subpath: str = ""):
    return await proxy_request(request, ws_http_base)
