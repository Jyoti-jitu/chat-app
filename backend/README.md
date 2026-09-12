# FluxChat Backend — Distributed Microservices Architecture

FluxChat Backend is a production-grade, modular microservices ecosystem engineered with **FastAPI**, **MongoDB Atlas (PyMongo Async / Motor)**, **Redis Pub/Sub**, and **WebSockets**.

This document serves as the master engineering blueprint and step-by-step implementation guide for all **29 Phases** of the backend architecture.

---

## 🏛️ Overall System Architecture

```text
                               ┌─────────────────────────┐
                               │    Next.js Frontend     │
                               │   (TypeScript / React)  │
                               └────────────┬────────────┘
                                            │
                                  HTTPS / WSS (Port 8000)
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │   API Gateway (Kong/Py) │
                               │  Reverse Proxy & Auth   │
                               └────────────┬────────────┘
                                            │
            ┌──────────────────┬────────────┴───────┬──────────────────┐
            │                  │                    │                  │
            ▼                  ▼                    ▼                  ▼
     ┌──────────────┐   ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
     │ Auth Service │   │ User Service │     │ Chat Service │   │ Message Svc  │
     │  (Port 8001) │   │  (Port 8002) │     │  (Port 8003) │   │  (Port 8004) │
     └──────┬───────┘   └──────┬───────┘     └──────┬───────┘   └──────┬───────┘
            │                  │                    │                  │
            └──────────────────┼────────────────────┴──────────────────┘
                               │
            ┌──────────────────┴────────────────────┐
            ▼                                       ▼
    ┌──────────────┐                        ┌──────────────┐
    │  WebSocket   │                        │ Notification │
    │   Service    │                        │   Service    │
    │  (Port 8005) │                        │  (Port 8006) │
    └──────┬───────┘                        └──────┬───────┘
           │                                       │
           ▼                                       ▼
    ┌──────────────┐                        ┌──────────────┐
    │ Redis PubSub │◄───────────────────────┤ Redis Cache  │
    │   (Presence) │                        │  (Port 6379) │
    └──────────────┘                        └──────────────┘
           ▲
           │ Persistence
           ▼
    ┌──────────────────────────────────────────────────────┐
    │        MongoDB Atlas (Cluster: chat.njrcbvy)         │
    │             Database: fluxchat_db                    │
    └──────────────────────────────────────────────────────┘
```

---

## 📐 Core Architectural Principles & Invariants

1. **Separation of Concerns Layering**:
   ```text
   Router (HTTP / WebSockets API Contract & Status Codes)
      ↓
   Service (Pure Business Logic, Domain Validation, Transformations)
      ↓
   Repository (Data Access Object & Database Queries)
      ↓
   MongoDB Atlas (Motor Async Client)
   ```
   - **Route Handlers**: Never execute raw database queries or direct collection calls.
   - **Services**: Pure business logic; never interact with raw database cursors or HTTP responses directly.
   - **Repositories**: Encapsulate all database interaction and query semantics.

2. **Isolated Repository Pattern**:
   - Every domain collection has a dedicated repository (`AuthRepository`, `UserRepository`, `ConversationRepository`, `MessageRepository`).
   - Enables unit testing with mock repositories without requiring an active database.

3. **Schema Isolation (Pydantic vs. MongoDB Documents)**:
   - Database documents (`_id`, `password_hash`) are never returned directly to clients.
   - Distinct Pydantic models: `CreateSchema` (input), `UpdateSchema` (patch), `InDBSchema` (internal), and `ResponseSchema` (sanitized output).

4. **MongoDB ObjectId Abstraction**:
   - `ObjectId` is translated to clean string `id` fields in external API contracts.

5. **Stateless JWT Authentication**:
   - Short-lived Access Tokens (15 min) for endpoint authorization.
   - Long-lived Refresh Tokens (30 days) stored securely for session rotation.

6. **12-Factor App Configuration**:
   - Zero hardcoded credentials. All secrets load dynamically from `.env` via `pydantic-settings`.

---

## 🗺️ Detailed Phase-by-Phase Roadmap (Phases 1 — 29)

---

### Phase 1 — FastAPI Backend Foundation
- **Status**: ✅ **COMPLETED**
- **Objective**: Scaffold the foundational microservice (`services/auth-service/`) with production standards.
- **Architecture**:
  ```text
  Client ──> FastAPI (lifespan) ──> CORS Middleware ──> Router (v1) ──> Response
  ```
- **Step-by-Step Implementation**:
  1. Initialize Python virtual environment with `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `httpx`, and `pytest`.
  2. Implement configuration management in `app/core/config.py` with `BaseSettings`.
  3. Configure structured console logging in `app/core/logging.py`.
  4. Build type-safe response contracts in `app/schemas/health.py`.
  5. Mount versioned router in `app/api/v1/router.py`.
  6. Assemble FastAPI application with CORS middleware in `app/main.py`.
  7. Add `.env.example`, `requirements.txt`, and runner script `run_auth_service.sh`.
- **Endpoints**:
  - `GET /` — Service descriptor: `{"message", "service", "docs_url", "health_url"}`
  - `GET /health` — Health check: `{"status": "ok", "service", "version", "environment"}`
  - `GET /api/v1/health` — Versioned health check
- **Automated Tests**: Unit tests in `tests/test_health.py` passing with `pytest`.

---

### Phase 2 — MongoDB Foundation
- **Status**: ✅ **COMPLETED**
- **Objective**: Establish the shared asynchronous MongoDB connection layer with MongoDB Atlas.
- **Architecture**:
  ```text
  FastAPI (Startup) ──> MongoDBManager.connect() ──> Motor Async Client ──> Atlas Cluster (ping)
  FastAPI (Shutdown) ──> MongoDBManager.disconnect() ──> Client Closed
  ```
- **Step-by-Step Implementation**:
  1. Create shared database module: `backend/shared/database/mongodb.py`.
  2. Implement `MongoDBManager` class supporting `connect()`, `disconnect()`, `is_connected()`, and `get_database()`.
  3. Add `certifi` CA bundle support to ensure zero TLS certificate issues connecting to Atlas SRV on macOS.
  4. Create `shared/database/indexes.py` for centralized index lifecycle management.
  5. Connect `auth-service` lifespan to MongoDB Atlas (`mongodb+srv://...`).
  6. Update health check schemas to report database connectivity:
     ```json
     {
       "status": "ok",
       "database": "connected",
       "service": "FluxChat Auth Service",
       "version": "1.0.0",
       "environment": "development"
     }
     ```
- **Database Verified**: Live Atlas cluster `chat.njrcbvy.mongodb.net`, database `fluxchat_db`.

---

### Phase 3 — Authentication Service
- **Status**: ✅ **COMPLETED**
- **Objective**: Implement user registration, secure credential verification, and JWT session handling.

---

### Phase 4 — Authorization & Security Dependencies
- **Status**: ✅ **COMPLETED**
- **Objective**: Build reusable FastAPI security dependencies to guard private endpoints.
- **Architecture**:
  ```text
  Request (Authorization: Bearer <token>)
     ↓
  FastAPI Dependency: get_current_user()
     ↓
  JWTService.decode_token() ──> Validates signature & expiration
     ↓
  AuthRepository.find_by_id() ──> Verifies user exists & active
     ↓
  Inject User into Endpoint Context / 401 Unauthorized / 403 Forbidden
  ```
- **Step-by-Step Implementation**:
  1. Create `backend/shared/security/dependencies.py` with `security_scheme = HTTPBearer(auto_error=False)`.
  2. Implement `get_current_user()` validating access tokens, revocation checks in `revoked_tokens`, and database active status.
  3. Reject refresh tokens and expired signatures with standard 401 response contracts.
  4. Implement role guards: `require_admin()` and `require_active_user()`.
  5. Tested and verified across multiple microservices.

---

### Phase 5 — User Service
- **Status**: ✅ **COMPLETED**
- **Objective**: Manage user profiles, avatars, bios, online presence flags, and user search.
- **Architecture**:
  ```text
  UserRouter ──> UserService ──> UserRepository ──> MongoDB (users collection)
  ```
- **Step-by-Step Implementation**:
  1. Scaffold `services/user-service/` on port **8002** with modular `api/`, `core/`, `schemas/`, `services/`, and `repositories/`.
  2. Define schemas: `UserProfileUpdate`, `UserProfileResponse`, `UserPublicProfileResponse`, `UserSearchResponse`.
  3. Implement `UserRepository` with MongoDB Atlas operations, `$set` updates, and safe regex directory search.
  4. Implement `UserService` business logic.
  5. Implemented Endpoints:
     - `GET   /api/v1/users/me` — Full authenticated profile
     - `PATCH /api/v1/users/me` — Update display name, bio, or avatar
     - `GET   /api/v1/users/{user_id}` — View any user's public profile
     - `GET   /api/v1/users/search?q={query}` — Search users for contacts or messaging
     - `GET   /health` — Microservice health check with database status
  6. Automated test suite in `tests/test_users.py` passing with 100% test coverage.
  7. Frontend API client in `frontend/lib/api/user.ts` and live profile page integration in `frontend/app/app/profile/page.tsx`.

---

### Phase 6 — Contacts Management
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Manage bidirectional connection requests and contact lists.
- **Architecture**:
  ```text
  ContactRouter ──> ContactService ──> ContactRepository ──> MongoDB (contact_requests, contacts)
  ```
- **Step-by-Step Implementation**:
  1. Create `contact_requests` collection:
     ```json
     {
       "_id": "ObjectId",
       "sender_id": "user_id_1",
       "recipient_id": "user_id_2",
       "status": "pending | accepted | rejected | cancelled",
       "created_at": "datetime",
       "updated_at": "datetime"
     }
     ```
  2. Create `contacts` collection storing established connections:
     ```json
     {
       "_id": "ObjectId",
       "user_id": "user_id_1",
       "contact_id": "user_id_2",
       "created_at": "datetime"
     }
     ```
  3. Implemented Endpoints in User Service (`http://localhost:8002`):
     - `POST   /api/v1/contacts/requests` — Send request by identifier (username/email/phone) or direct `recipient_id`. Prevents self-request and duplicates.
     - `GET    /api/v1/contacts/requests` — List received and sent requests with hydrated sender/recipient profiles.
     - `POST   /api/v1/contacts/requests/{id}/accept` — Accept request and insert bidirectional contact entries.
     - `POST   /api/v1/contacts/requests/{id}/reject` — Reject request.
     - `POST   /api/v1/contacts/requests/{id}/cancel` — Cancel sent request.
     - `DELETE /api/v1/contacts/{contact_id}` — Remove contact from roster (removes bidirectional connection).
     - `GET    /api/v1/contacts` — List all contacts with online presence metadata.
  4. Security: Enforce that only the target `recipient_id` can accept or reject a request, and only `sender_id` can cancel.
  5. Frontend integration: API client in `frontend/lib/api/contact.ts`, live UI wiring in `frontend/app/app/contacts/page.tsx` and `frontend/app/app/requests/page.tsx`.
  6. Automated test suite: `tests/test_contacts.py` passing with 100% success.

---

### Phase 7 — Chat & Conversation Service
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Conversation management for direct (1:1) and group channels.
- **Architecture**:
  ```text
  ConversationRouter ──> ConversationService ──> ConversationRepository ──> MongoDB (conversations)
  ```
- **Step-by-Step Implementation**:
  1. Define Conversation Model:
     ```json
     {
       "_id": "ObjectId",
       "type": "direct | group",
       "name": "Team Squad",            # null for direct chat
       "avatar": "https://...",          # null for direct chat
       "members": ["user_id_1", "user_id_2"],
       "admins": ["user_id_1"],
       "last_message_id": "msg_id",
       "created_by": "user_id_1",
       "created_at": "datetime",
       "updated_at": "datetime"
     }
     ```
  2. Implement `ConversationRepository`:
     - `find_direct_conversation(user_a, user_b)`: Avoids duplicate direct chats between two users.
     - `find_user_conversations(user_id)`: Queries `{ members: user_id }` sorted by `{ updated_at: -1 }`.
     - `create_conversation()`, `add_members()`, `remove_member()`, `update_group_info()`, `delete_conversation()`.
     - `get_users_profiles()`: Batch hydrates participant public profiles.
  3. Implemented Endpoints in Chat Service (`http://localhost:8003`):
     - `POST   /api/v1/conversations/direct` — Start or retrieve 1:1 direct chat with duplicate prevention.
     - `POST   /api/v1/conversations/group` — Create group conversation with title, members, and admin role.
     - `GET    /api/v1/conversations` — List conversations current user is a member of with dynamic partner titles.
     - `GET    /api/v1/conversations/{id}` — Detailed conversation data with member list and IDOR protection.
     - `PATCH  /api/v1/conversations/{id}` — Update group name or avatar (Admin only).
     - `POST   /api/v1/conversations/{id}/members` — Add members to group.
     - `DELETE /api/v1/conversations/{id}/members/{user_id}` — Remove member from group (Admin only).
     - `POST   /api/v1/conversations/{id}/leave` — Voluntarily leave conversation.
  4. Frontend integration: API client in `frontend/lib/api/chat.ts`, live UI wiring in `frontend/components/chat/ConversationList.tsx` with direct message and group creation modals.
  5. Automated test suite: `tests/test_conversations.py` passing with 100% success.

---

### Phase 8 — Message Service
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Full message persistence, editing, soft deletion, and status tracking.
- **Architecture**:
  ```text
  MessageRouter ──> MessageService ──> MessageRepository ──> MongoDB (messages)
  ```
- **Step-by-Step Implementation**:
  1. Define Message Model:
     ```json
     {
       "_id": "ObjectId",
       "conversation_id": "conv_id",
       "sender_id": "user_id",
       "content": "Hello world",
       "type": "text | image | file | audio",
       "attachment": { "name": str, "size": str, "url": str, "type": str },
       "reply_to": "parent_msg_id",
       "status": "sent | delivered | read",
       "edited": false,
       "deleted": false,
       "created_at": "datetime",
       "updated_at": "datetime"
     }
     ```
  2. Implement `MessageRepository`:
     - `create_message(data)`: Persists message with timestamp and attachments.
     - `get_messages_by_conversation(conv_id, limit, skip)`: Returns messages in chronological thread order.
     - `edit_message(msg_id, new_content)`: Updates content and sets `edited: true`.
     - `soft_delete_message(msg_id)`: Replaces content with placeholder and sets `deleted: true`.
     - `mark_as_read(msg_id)`: Updates status to "read".
     - `update_conversation_last_message()`: Keeps conversation preview synchronized.
  3. Implemented Endpoints in Message Service (`http://localhost:8004`):
     - `POST   /api/v1/conversations/{id}/messages` — Send message (verifies caller is conversation member).
     - `GET    /api/v1/conversations/{id}/messages` — Retrieve conversation message thread.
     - `PATCH  /api/v1/messages/{id}` — Edit message (author only, sets `edited: true`).
     - `DELETE /api/v1/messages/{id}` — Soft delete (author only, replaces content with "This message was deleted").
     - `POST   /api/v1/messages/{id}/read` — Mark message as read.
  4. Frontend integration: API client in `frontend/lib/api/message.ts`, live UI wiring in `frontend/app/app/chats/[conversationId]/page.tsx` with optimistic dispatch, thread sync, and read receipts.
  5. Automated test suite: `tests/test_messages.py` passing with 100% success.

---

### Phase 9 — Cursor-Based Message Pagination
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Infinite scroll message pagination without memory exhaustion or query drift.
- **Architecture**:
  ```text
  Client GET /conversations/{id}/messages?cursor={token}&limit=30
     ↓
  Decode Cursor -> (timestamp, object_id)
     ↓
  MongoDB Query: { conversation_id: id, created_at: { $lt: timestamp } }
     ↓
  Sort: { created_at: -1, _id: -1 } -> Limit 30
     ↓
  Encode Last Item as next_cursor -> Client Response
  ```
- **Compound Index**: `{ conversation_id: 1, created_at: -1, _id: -1 }`.
- **Response**:
  ```json
  {
    "items": [...],
    "next_cursor": "eyJjcmVhdGVkX2F0IjoxNzQwMDAwLCJpZCI6IjY3...",
    "has_more": true
  }
  ```
- **Step-by-Step Implementation**:
  1. Created `app/core/pagination.py` in Message Service for packing and unpacking base64url JSON cursors safely with timestamp and ObjectId tie-breaker.
  2. Registered compound index `{ conversation_id: 1, created_at: -1, _id: -1 }` in `backend/shared/database/indexes.py`.
  3. Updated `MessageRepository.get_messages_by_conversation` to fetch `limit + 1` reverse-chronologically and slice into chronological items, `next_cursor`, and `has_more`.
  4. Updated `MessageService` and FastAPI router `GET /api/v1/conversations/{conversation_id}/messages` with `cursor` and `limit` query parameters.
  5. Updated frontend `getMessages(conversationId, limit, cursor, token)` in `frontend/lib/api/message.ts` and wired into `frontend/app/app/chats/[conversationId]/page.tsx`.
  6. Automated test suite in `tests/test_messages.py` (`test_cursor_pagination`) verified with 100% test coverage.

---

### Phase 10 — Frontend REST Integration
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Sequentially swap out frontend mock data with live FastAPI backend calls.
- **Sequence**:
  1. **Auth Integration**: Created Next.js `frontend/lib/api/auth.ts` with typed helpers for `/auth/login`, `/auth/login-otp`, `/auth/register`, `/auth/send-otp`, and `/auth/verify-otp`. Stores JWT access tokens securely in `localStorage` (`fluxchat_access_token`).
  2. **Profile & Settings**: Wired `frontend/lib/api/user.ts` (`/api/v1/users/me` and `/api/v1/users/search`) to dashboard profile views and settings pages.
  3. **Contacts**: Wired `frontend/lib/api/contact.ts` (`/api/v1/contacts` and `/api/v1/contacts/requests`) to Contacts view (`app/app/contacts/page.tsx`) and Requests view (`app/app/requests/page.tsx`).
  4. **Chat List**: Wired `frontend/lib/api/chat.ts` (`/api/v1/conversations`) to `ConversationList.tsx` sidebar with dynamic partner labels, avatars, and direct/group creation dialogs.
  5. **Message Thread**: Wired `frontend/lib/api/message.ts` (`/api/v1/conversations/{id}/messages`) to active chat view (`app/app/chats/[conversationId]/page.tsx`) with cursor pagination, optimistic dispatch, soft deletion, and read status.


---

### Phase 11 — WebSocket Service
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Real-time bidirectional socket connections with handshake authentication.
- **Architecture**:
  ```text
  Client ──> ws://localhost:8005/ws?token=<jwt_access_token>
     ↓
  Validate JWT in Handshake -> Extract user_id
     ↓
  ConnectionManager.connect(user_id, websocket)
     ↓
  Listen for incoming frames / Send outgoing frames
     ↓
  ConnectionManager.disconnect(user_id, websocket)
  ```
- **ConnectionManager**:
  - Tracks `active_connections: Dict[str, Set[WebSocket]]` to support multiple tabs/devices per user.
- **Endpoints in WebSocket Service (`http://localhost:8005`)**:
  - `WS   /ws?token={jwt}` — Authenticated real-time WebSocket connection.
  - `GET  /health` — Microservice health check with active user and connection counts.
  - `POST /api/v1/events/broadcast` — Cross-service REST broadcast bridge.
  - `GET  /api/v1/presence/online` — List active online users.
  - `GET  /api/v1/presence/{user_id}` — Query specific user's live presence status.
- **Automated Tests**: `tests/test_websocket.py` with 100% pass rate.
- **Daemon Launcher**: `backend/run_websocket_service.sh` active on port 8005.

---

### Phase 12 — WebSocket Event Protocol
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Strongly-typed event protocol for all socket communication.
- **Standardized Envelope**:
  ```json
  {
    "event": "message.new",
    "timestamp": 1740000000,
    "data": {
      "message_id": "...",
      "conversation_id": "...",
      "sender_id": "...",
      "content": "Hello!"
    }
  }
  ```
- **Implemented Event Catalog**:
  - `connection.ack` — Sent to client upon handshake validation with online user roster.
  - `ping` / `pong` — Heartbeat keep-alive exchange every 25 seconds.
  - `message.new` — Broadcast newly sent message to conversation participants.
  - `message.updated` — Broadcast edited message content.
  - `message.deleted` — Broadcast soft deletion placeholder.
  - `message.read` — Read receipt updates.
  - `typing.start` / `typing.stop` — Ephemeral typing notification relay.
  - `user.online` / `user.offline` — Presence status notifications.
- **Frontend Client**: `frontend/lib/api/websocket.ts` with exponential backoff, auto-reconnection, and typed event listeners.

---

### Phase 13 — Redis Foundation (Pub/Sub & Caching)
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Connect Redis to enable horizontal scaling, distributed event broadcasting, and high-performance caching.
- **Architecture**:
  ```text
  Message Service ──> Redis Pub/Sub (channel: fluxchat:events) ──> WebSocket Workers ──> Client Sockets
  ```
- **Implementation**:
  - Created [`backend/shared/redis/client.py`](file:///Users/apple/Desktop/project/chat-app/backend/shared/redis/client.py) with `RedisManager` supporting real Redis (`redis.asyncio`) with transparent resilient async in-memory Pub/Sub and KV caching fallback (`InMemoryRedis` & `InMemoryPubSub`).
  - Key-Value operations (`set`, `get`, `delete`), counters (`incr`, `decr`), sets (`sadd`, `srem`, `smembers`), and non-blocking channel subscribers (`pubsub()`, `publish()`).
  - Automated test suite in `backend/shared/redis/test_redis.py` (100% pass rate).

---

### Phase 14 — End-to-End Real-Time Message Flow
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Complete end-to-end pipeline from client input to DB persistence and live socket push.
- **Architecture & Implementation**:
  1. User dispatches message from frontend UI or REST API.
  2. Message Service validates sender membership and persists document to MongoDB Atlas.
  3. Message Service publishes `message.new` frame to Redis channel `fluxchat:events`.
  4. WebSocket Service receives Redis event via background worker and relays frame to connected recipient sockets.
  5. Next.js active chat view (`app/app/chats/[conversationId]/page.tsx`) receives `message.new` over WebSocket and appends it to thread with deduplication and animated typing indicators.
  6. Edits (`message.updated`), soft deletions (`message.deleted`), and read receipts (`message.read`) broadcast across the same distributed pipeline.
- **Verification**: Verified with automated test suites across Redis, Message Service, and WebSocket Service.


---

### Phase 15 — Online Presence System
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Track user availability accurately without excessive database writes.
- **Implementation**:
  - Redis connection counters `presence:count:{user_id}` and status key `presence:{user_id} -> "online"`.
  - On socket connect: increment user connection counter in Redis. If count == 1, publish `user.online` and sync MongoDB `users.is_online = True`.
  - On socket disconnect: decrement counter. If count <= 0, delete Redis presence key, publish `user.offline`, and set `last_seen` timestamp in MongoDB Atlas.

---

### Phase 16 — Ephemeral Typing Indicators
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Instant typing indicators without database load.
- **Implementation**:
  - User starts typing ➔ frontend emits `{ "event": "typing.start", "conversation_id": "c1" }`.
  - Store ephemeral key in Redis: `typing:{conv_id}:{user_id}` with `EXPIRE 4`.
  - Relayed to conversation members via WebSocket Service.
  - On typing stop or timeout, broadcast `typing.stop` and delete Redis key.
  - Active chat UI displays smooth animated typing bubble with bouncing dots.

---

### Phase 17 — Delivery & Read Receipts
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Track `sent`, `delivered`, and `read` statuses with real-time UI synchronization.
- **Implementation**:
  - Message sent ➔ saved in MongoDB Atlas as `"sent"`.
  - Recipient socket receives frame ➔ emits `message.delivered` ➔ MongoDB status updated to `"delivered"` and status event broadcast.
  - Recipient views message in viewport ➔ emits `message.read` ➔ status updated in MongoDB to `"read"` and `message.read` receipt broadcast to conversation participants.
  - UI visual indicators reflect live status transitions.


---

### Phase 18 — Notification Service
- **Objective**: Real-time and persistent alerts for messages, contact requests, and group invites.
- **Endpoints**:
  - `GET  /api/v1/notifications` — Fetch user's notifications.
  - `POST /api/v1/notifications/{id}/read` — Mark notification as read.
  - `POST /api/v1/notifications/read-all` — Mark all as read.
  - `DELETE /api/v1/notifications/{id}` — Dismiss notification.
  - `DELETE /api/v1/notifications` — Clear all notifications.

---

### Phase 19 — API Gateway
- **Objective**: Central reverse proxy and traffic manager for the microservices suite.
- **Route Mapping**:
  - `/api/v1/auth/*` ➔ Auth Service (`http://127.0.0.1:8001`)
  - `/api/v1/users/*` ➔ User Service (`http://127.0.0.1:8002`)
  - `/api/v1/conversations/*` ➔ Chat Service (`http://127.0.0.1:8003`)
  - `/api/v1/messages/*` ➔ Message Service (`http://127.0.0.1:8004`)
  - `/ws` ➔ WebSocket Service (`ws://127.0.0.1:8005`)
  - `/api/v1/notifications/*` ➔ Notification Service (`http://127.0.0.1:8006`)
- **Features**: Centralized CORS headers, request ID tagging, rate limiting.

---

### Phase 20 — Service-to-Service Communication Guidelines
- **Synchronous Communication**:
  - Use `httpx.AsyncClient` for blocking, immediate data requests (e.g., Gateway validating token with Auth Service).
- **Asynchronous Communication**:
  - Use Redis Pub/Sub events for non-blocking notifications, presence updates, and analytics.

---

### Phase 21 — Standardized Error Handling
- **Objective**: Uniform error responses across all microservices.
- **Error Format**:
  ```json
  {
    "error": {
      "code": "USER_NOT_FOUND",
      "message": "The requested user does not exist",
      "request_id": "req_8bc739f",
      "timestamp": "2026-09-12T19:00:00Z"
    }
  }
  ```
- **Custom Exceptions**:
  - `AuthenticationError` (401)
  - `AuthorizationError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `ValidationError` (422)

---

### Phase 22 — Structured JSON Logging
- **Objective**: Full auditability and centralized log ingestion.
- **Log Format**:
  ```json
  {
    "timestamp": "2026-09-12T19:00:00Z",
    "service": "auth-service",
    "level": "INFO",
    "request_id": "req_123",
    "user_id": "u_me",
    "message": "User login successful"
  }
  ```
- **Sanitization Rule**: Automatically redact `password`, `token`, `refresh_token`, and `authorization` headers.

---

### Phase 23 — Comprehensive Security & Hardening
- **Defense-in-Depth Measures**:
  - **IDOR Protection**: Verify user membership on every conversation, message, and contact action.
  - **Rate Limiting**: Sliding window rate limiting on `/auth/login` (5 attempts / min) and `/auth/register` (3 attempts / hour) using Redis.
  - **Injection Prevention**: Strongly typed Pydantic models prevent NoSQL query injection.
  - **CORS Constraints**: Allow only verified domains (`http://localhost:3000`).

---

### Phase 24 — MongoDB Compound Indexes Optimization
- **Index Catalog**:
  - `users`: `{ email: 1 }` (unique), `{ username: 1 }` (unique)
  - `messages`: `{ conversation_id: 1, created_at: -1 }`
  - `conversations`: `{ members: 1, updated_at: -1 }`
  - `contact_requests`: `{ sender_id: 1, recipient_id: 1 }` (unique)
  - `notifications`: `{ user_id: 1, created_at: -1, is_read: 1 }`

---

### Phase 25 — Automated Testing Suite
- **Directory**: `tests/` across each microservice.
- **Structure**:
  - `tests/unit/`: Test password hashing, JWT encoding/decoding, cursor token packing.
  - `tests/integration/`: Test repository CRUD against live MongoDB Atlas.
  - `tests/api/`: Test full HTTP endpoints and status codes using `httpx.AsyncClient` with `ASGITransport`.

---

### Phase 26 — Docker Containerization
- **Objective**: Containerize all services with production-ready multi-stage Docker builds.
- **Docker Compose Setup (`docker-compose.yml`)**:
  - Services: `gateway`, `auth-service`, `user-service`, `chat-service`, `message-service`, `websocket-service`, `notification-service`, `redis`.
  - Configures internal service networking and health checks.

---

### Phase 27 — Environment Configuration & 12-Factor Compliance
- **Deliverables**:
  - `.env.example` templates in root and each microservice.
  - Production environment checklist (JWT secrets, Atlas credentials, Redis connection strings).

---

### Phase 28 — OpenAPI & API Documentation
- **Deliverables**:
  - Interactive Swagger UI (`/docs`) and ReDoc (`/redoc`) configured on every service.
  - Typed request bodies, response models, and status code descriptions.

---

### Phase 29 — Production Architecture & Scaling
- **Deliverables**:
  - Kubernetes / ECS deployment readiness.
  - Liveness probes (`/health/live`) and Readiness probes (`/health/ready`).
  - Zero-downtime rolling restart procedures.

---

## 🔌 Microservice Port Mapping Table

| Service | Port | Primary Database / Storage | Description |
|---|---|---|---|
| **API Gateway** | `8000` | None (Reverse Proxy) | Unified ingress proxy for frontend |
| **Auth Service** | `8001` | MongoDB Atlas (`users`) | Registration, Login, JWT verification |
| **User Service** | `8002` | MongoDB Atlas (`users`) | Profiles, settings, user search |
| **Chat Service** | `8003` | MongoDB Atlas (`conversations`) | Direct & group chat management |
| **Message Service**| `8004` | MongoDB Atlas (`messages`) | Message CRUD, pagination, replies |
| **WebSocket Svc** | `8005` | Redis (Sockets / PubSub) | Real-time events, presence, typing |
| **Notification Svc**| `8006`| MongoDB Atlas (`notifications`)| Notification center & alerts |
| **Redis Broker** | `6379` | In-Memory / Snapshot | Cache, Pub/Sub, Presence keys |
| **MongoDB Atlas**| `27017`| Cloud Atlas (Replica Set) | Persistent document source of truth |

---

## ⚡ Current Progress Summary

- **Phase 1 (FastAPI Foundation)**: ✅ **Completed & Verified**
- **Phase 2 (MongoDB Atlas Foundation)**: ✅ **Completed & Verified**
  - Connected to: `mongodb+srv://parhijyotiswarup_db_user:***@chat.njrcbvy.mongodb.net/?appName=Chat`
  - Health check: `{"status": "ok", "database": "connected"}`
- **Phase 3 (Authentication Service)**: ✅ **Completed & Verified**
  - Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/send-otp`, `POST /auth/verify-otp`
  - Bcrypt hashing (12 rounds) & JWT (HS256 with token rotation & revocation)
  - 2Factor SMS OTP gateway integration
  - Full automated tests passing (`9/9 passed`)
- **Phase 4 (Authorization & Security Dependencies)**: ✅ **Completed & Verified**
  - Reusable JWT dependencies `get_current_user`, `require_active_user`, `require_admin` in `shared/security/dependencies.py`
- **Phase 5 (User Service Microservice)**: ✅ **Completed & Verified**
  - Running on port **8002**, MongoDB Atlas integration, profile retrieval/update, user directory search, public profile endpoints, and frontend profile page integration.
  - Full automated tests passing (`3/3 passed`)
- **Phase 6 (Contacts Management)**: ✅ **Completed & Verified**
  - Bidirectional connection requests (`POST /api/v1/contacts/requests`), accept/reject/cancel lifecycles, roster retrieval (`GET /api/v1/contacts`), contact removal (`DELETE /api/v1/contacts/{id}`), frontend API client and live UI pages (`/app/contacts`, `/app/requests`).
  - Full automated tests passing (`4/4 passed`)
- **Phase 7 (Chat & Conversation Service)**: ✅ **Completed & Verified**
  - Running on port **8003**, MongoDB Atlas `conversations` integration, direct 1:1 chat deduplication, group conversation channels, member management, and frontend conversation sidebar integration (`/app/chats`).
  - Full automated tests passing (`2/2 passed`)
- **Phase 8 (Message Service)**: ✅ **Completed & Verified**
  - Running on port **8004**, MongoDB Atlas `messages` integration, author-only editing and soft deletion, read receipts, and live conversation thread integration (`/app/chats/[id]`).
  - Full automated tests passing (`2/2 passed`)
- **Phase 9 (Cursor-Based Message Pagination)**: ⏳ **Next in Queue**
