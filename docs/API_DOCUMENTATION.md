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

## 3. Standardized Error Responses

All microservices return errors in a clear, consistent JSON format:

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
- `FORBIDDEN` (403): User lacks authorization or failed ownership check.
- `NOT_FOUND` (404): Resource not found.
- `CONFLICT` (409): Duplicate entity (e.g. username/email already registered).
- `TOO_MANY_REQUESTS` (429): Rate limit exceeded (`Retry-After` header sent).
- `INTERNAL_SERVER_ERROR` (500): Server error.
- `BAD_GATEWAY` (502): Downstream microservice unreachable.

---

## 4. Endpoint Reference Summary

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new account (`username`, `email`, `password`, optional `phone`).
- `POST /api/v1/auth/login` — Authenticate using email or phone with password. Returns access & refresh tokens.
- `POST /api/v1/auth/refresh` — Issue a fresh access token using a valid refresh token.
- `POST /api/v1/auth/logout` — Revoke active tokens and terminate session.
- `GET  /api/v1/auth/me` — Retrieve the current authenticated user identity.
- `POST /api/v1/auth/send-otp` — Dispatch 6-digit SMS verification code.
- `POST /api/v1/auth/verify-otp` — Verify SMS OTP and authenticate.

### Users & Directory (`/api/v1/users`)
- `GET  /api/v1/users/me` — Get current user profile details.
- `PUT  /api/v1/users/me` — Update display name, bio, avatar, cover image, phone, website, or settings.
- `GET  /api/v1/users/search?q={query}` — Search users by username, email, or telephone.
- `GET  /api/v1/users/{id}` — Retrieve public user profile.

### Cloudinary Media Storage (`/api/v1/media`)
- `POST /api/v1/media/upload` — Upload multipart file to Cloudinary (returns secure HTTPS URL, size, and metadata).
- `POST /api/v1/media/upload-base64` — Upload base64 / data URI string directly to Cloudinary.

### Status Stories (`/api/v1/status`)
- `GET  /api/v1/status` — Get active 24-hour status stories from connected contacts.
- `POST /api/v1/status` — Post a new photo or text status story (auto-expires in 24 hours).
- `DELETE /api/v1/status/{slide_id}` — Delete a specific status slide.
- `DELETE /api/v1/status` — Delete all status stories posted by current user.

### Contacts & Connections (`/api/v1/contacts`)
- `GET  /api/v1/contacts` — List current user's connected contacts.
- `DELETE /api/v1/contacts/{contact_id}` — Remove contact from roster.
- `POST /api/v1/contacts/requests` — Send a connection request to `recipient_id`.
- `GET  /api/v1/contacts/requests` — List received and sent pending connection requests.
- `POST /api/v1/contacts/requests/{id}/accept` — Accept pending connection request.
- `POST /api/v1/contacts/requests/{id}/reject` — Reject pending connection request.
- `POST /api/v1/contacts/requests/{id}/cancel` — Cancel sent connection request.

### Conversations & Groups (`/api/v1/conversations`)
- `GET  /api/v1/conversations` — Fetch user's conversation inbox sorted by recent activity.
- `POST /api/v1/conversations/direct` — Start or retrieve 1:1 conversation with `recipient_id`.
- `POST /api/v1/conversations/group` — Create a group with `name`, `join_mode` (`open` or `approval`), `description`, and `avatar`.
- `GET  /api/v1/conversations/{id}` — Get conversation details, join mode, and participant metadata.
- `DELETE /api/v1/conversations/{id}` — Permanently delete conversation, wiping all messages and history.
- `DELETE /api/v1/conversations/{id}/messages` — Clear all message history in conversation.
- `POST /api/v1/conversations/{id}/join` — Request to join or join group directly.
- `GET  /api/v1/conversations/{id}/join-requests` — List pending join requests (Admin only).
- `POST /api/v1/conversations/{id}/join-requests/{user_id}/approve` — Approve user join request.
- `POST /api/v1/conversations/{id}/join-requests/{user_id}/reject` — Reject user join request.
- `PATCH /api/v1/conversations/{id}/settings` — Update group settings (name, avatar, description, join mode).
- `POST /api/v1/conversations/{id}/admins/{user_id}` — Promote member to group admin.
- `DELETE /api/v1/conversations/{id}/members/{user_id}` — Remove member from group.

### Messages (`/api/v1/conversations/{id}/messages` & `/api/v1/messages`)
- `GET  /api/v1/conversations/{id}/messages` — Retrieve cached conversation messages (Redis cached).
- `POST /api/v1/conversations/{id}/messages` — Send a new text or Cloudinary media message.
- `PUT  /api/v1/messages/{id}` — Edit existing message (author-only, flagged as `edited: true`).
- `DELETE /api/v1/messages/{id}` — Delete message for everyone (author-only).
- `POST /api/v1/messages/{id}/read` — Acknowledge message delivery and mark as read.

### WebSocket Real-Time Events (`ws://localhost:8000/ws`)
- `message.new` — Inbound/outbound real-time message payload.
- `message.updated` — Live notification when a message is edited.
- `message.deleted` — Live notification when a message is deleted.
- `message.read` — Real-time read receipt (triggers double green checkmarks).
- `typing.start` / `typing.stop` — Live typing indicators.
- `user.online` / `user.offline` — Presence status transitions.
- `conversation.deleted` / `messages.cleared` — Live thread purge sync.

### Health Check (`/health`)
- `GET /health` & `GET /api/v1/health` — Cluster health aggregator returning HTTP 200 and per-service statuses.

