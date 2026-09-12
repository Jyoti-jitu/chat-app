# 📖 FluxChat Enterprise: API Specification & Developer Guide

Welcome to the **FluxChat** distributed platform API documentation. All client requests should be routed through the unified **API Gateway** on port `8000`.

---

## 1. Interactive Documentation Portals

| Portal | URL | Description |
|---|---|---|
| **Multi-Spec Swagger UI** | `http://localhost:8000/docs` | Interactive API explorer with dropdown selector for all microservices |
| **ReDoc UI** | `http://localhost:8000/redoc` | Clean, responsive technical reference documentation |
| **Unified OpenAPI JSON** | `http://localhost:8000/openapi.json` | Aggregated OpenAPI 3.1 schema for Postman/Insomnia imports |
| **Auth Service Docs** | `http://localhost:8001/docs` | Dedicated Auth Service Swagger UI |
| **User Service Docs** | `http://localhost:8002/docs` | Dedicated User Service Swagger UI |
| **Chat Service Docs** | `http://localhost:8003/docs` | Dedicated Chat Service Swagger UI |
| **Message Service Docs**| `http://localhost:8004/docs` | Dedicated Message Service Swagger UI |
| **WebSocket Docs** | `http://localhost:8005/docs` | Dedicated WebSocket Service Swagger UI |
| **Notification Docs** | `http://localhost:8006/docs` | Dedicated Notification Service Swagger UI |

---

## 2. Authentication & Authorization

All protected routes require an `Authorization` HTTP header with a valid JWT Bearer token:
```http
Authorization: Bearer <access_token>
```

For real-time WebSocket connections, supply the token as a URL query parameter:
```
ws://localhost:8000/ws?token=<access_token>
```

---

## 3. Canonical Error Response Envelope (Phase 21)

All microservices return errors in a standardized JSON envelope:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "The requested user does not exist",
    "request_id": "req_8bc739f12a",
    "timestamp": "2026-09-12T19:00:00Z",
    "details": null
  },
  "detail": "The requested user does not exist"
}
```

### Common Error Codes
- `BAD_REQUEST` (400): Malformed input payload or syntax error.
- `AUTHENTICATION_FAILED` (401): Missing, invalid, or expired JWT Bearer token.
- `FORBIDDEN` (403): User lacks authorization or failed IDOR ownership check.
- `NOT_FOUND` (404): Resource not found.
- `CONFLICT` (409): Duplicate entity (e.g. username/email already registered).
- `TOO_MANY_REQUESTS` (429): Rate limit exceeded (`Retry-After` header sent).
- `INTERNAL_SERVER_ERROR` (500): Unhandled exception.
- `BAD_GATEWAY` (502): Downstream microservice unreachable.

---

## 4. Endpoint Reference Summary

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new account (`username`, `email`, `password`, optional `phone`).
- `POST /api/v1/auth/login` — Authenticate using email or phone with password. Returns access & refresh tokens.
- `POST /api/v1/auth/refresh` — Issue a fresh access token using a valid refresh token.
- `POST /api/v1/auth/logout` — Revoke active tokens and terminate session.
- `GET  /api/v1/auth/me` — Retrieve the current authenticated user identity.
- `POST /api/v1/auth/send-otp` — Dispatch 6-digit SMS verification code (2Factor.in / dev sandbox).
- `POST /api/v1/auth/verify-otp` — Verify SMS OTP and authenticate.

### Users & Directory (`/api/v1/users`)
- `GET  /api/v1/users/me` — Get current user profile details.
- `PUT  /api/v1/users/me` — Update display name, bio, avatar, or settings.
- `GET  /api/v1/users/search?q={query}` — Search users by username, email, or telephone.
- `GET  /api/v1/users/{id}` — Retrieve public user profile.

### Contacts & Roster (`/api/v1/contacts`)
- `GET  /api/v1/contacts` — List current user's bilateral contacts.
- `DELETE /api/v1/contacts/{contact_id}` — Remove contact from roster.
- `POST /api/v1/contacts/requests` — Send a friend request to `recipient_id`.
- `GET  /api/v1/contacts/requests` — List received and sent pending contact requests.
- `POST /api/v1/contacts/requests/{id}/accept` — Accept pending friend request.
- `POST /api/v1/contacts/requests/{id}/reject` — Reject pending friend request.
- `POST /api/v1/contacts/requests/{id}/cancel` — Cancel sent friend request.

### Conversations & Groups (`/api/v1/conversations`)
- `GET  /api/v1/conversations` — Fetch user's conversation inbox sorted by recent activity.
- `POST /api/v1/conversations/direct` — Start or retrieve deduplicated 1:1 conversation with `recipient_id`.
- `POST /api/v1/conversations/group` — Create a multi-participant group channel.
- `GET  /api/v1/conversations/{id}` — Get conversation details and participant metadata.
- `POST /api/v1/conversations/{id}/members` — Add members to a group channel.
- `DELETE /api/v1/conversations/{id}/members/{user_id}` — Remove member or leave group.

### Messages (`/api/v1/conversations/{id}/messages` & `/api/v1/messages`)
- `GET  /api/v1/conversations/{id}/messages` — Cursor-paginated message history (`cursor`, `limit=50`, `direction=before`).
- `POST /api/v1/conversations/{id}/messages` — Send a new text/media message.
- `PUT  /api/v1/messages/{id}` — Edit existing message (author-only, flagged as `is_edited: true`).
- `DELETE /api/v1/messages/{id}` — Soft-delete message (author-only, flagged as `is_deleted: true`).
- `POST /api/v1/messages/{id}/reactions` — Toggle emoji reaction on message.
- `POST /api/v1/messages/{id}/pin` — Pin/unpin message in conversation.
- `POST /api/v1/messages/{id}/read` — Acknowledge message delivery and mark as read.

### WebSocket Real-Time Framing (`ws://localhost:8000/ws`)
- `connection.ack` — Server acknowledgement with `user_id` and initial `online_users` list.
- `chat.message` — Real-time inbound/outbound message payload.
- `presence.status` — User state transition (`online`, `away`, `offline`).
- `typing.start` / `typing.stop` — Ephemeral typing bubbles.
- `ping` / `pong` — 30-second heartbeat check.

### Notifications (`/api/v1/notifications`)
- `GET  /api/v1/notifications` — Retrieve notification feed (supports `category` filtering and `unread_only`).
- `POST /api/v1/notifications/{id}/read` — Mark notification as read.
- `POST /api/v1/notifications/read-all` — Mark all notifications as read.
- `DELETE /api/v1/notifications/{id}` — Dismiss notification.
- `DELETE /api/v1/notifications` — Clear all notifications.

### Health & Monitoring (`/health`)
- `GET /health` & `GET /api/v1/health` — Concurrent cluster health aggregator.
  ```json
  {
    "status": "healthy",
    "service": "FluxChat API Gateway",
    "services": {
      "auth-service": { "status": "healthy", "latency_ms": 115.4 },
      "user-service": { "status": "healthy", "latency_ms": 120.2 },
      "chat-service": { "status": "healthy", "latency_ms": 230.1 },
      "message-service": { "status": "healthy", "latency_ms": 210.8 },
      "websocket-service": { "status": "healthy", "latency_ms": 214.5 },
      "notification-service": { "status": "healthy", "latency_ms": 238.9 }
    }
  }
  ```
