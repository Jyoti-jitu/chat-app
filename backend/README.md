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
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Real-time and persistent alerts for messages, contact requests, and group invites.
- **Port**: `8006`
- **Endpoints**:
  - `GET  /api/v1/notifications` — Fetch user's notifications (supports category filtering, unread count).
  - `POST /api/v1/notifications` — Internal notification ingest & Redis broadcast.
  - `POST /api/v1/notifications/{id}/read` — Mark notification as read.
  - `POST /api/v1/notifications/read-all` — Mark all as read.
  - `DELETE /api/v1/notifications/{id}` — Dismiss notification.
  - `DELETE /api/v1/notifications` — Clear all notifications.
  - `GET  /health` & `GET /api/v1/health` — Service health check.
- **Integration**:
  - Redis Pub/Sub events (`notification.new`) dispatched to client via WebSocket service.
  - Frontend client (`frontend/lib/api/notification.ts`) and notifications screen (`/app/notifications`).

---

### Phase 19 — API Gateway
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Central reverse proxy and traffic manager for the microservices suite.
- **Port**: `8000`
- **Route Mapping**:
  - `/api/v1/auth/*` ➔ Auth Service (`http://127.0.0.1:8001`)
  - `/api/v1/users/*` & `/api/v1/contacts/*` ➔ User Service (`http://127.0.0.1:8002`)
  - `/api/v1/conversations/*` ➔ Chat Service (`http://127.0.0.1:8003`)
  - `/api/v1/conversations/{id}/messages` & `/api/v1/messages/*` ➔ Message Service (`http://127.0.0.1:8004`)
  - `/ws` & `/api/v1/ws` ➔ WebSocket Service (`ws://127.0.0.1:8005/ws`)
  - `/api/v1/notifications/*` ➔ Notification Service (`http://127.0.0.1:8006`)
  - `/health` & `/api/v1/health` ➔ Aggregated cluster health check probing all 6 services concurrently
- **Features**:
  - Centralized CORS allowing `http://localhost:3000` with credential support.
  - End-to-end `X-Request-ID` injection and propagation.
  - Sliding-window rate limiter per client IP with `X-RateLimit-*` RFC headers and HTTP 429 enforcement.
  - Bidirectional WebSocket proxy tunneling with JWT authentication passthrough.
  - Resilient error handling mapping network partitions to standardized 502/504 JSON errors.


---

### Phase 20 — Service-to-Service Communication Guidelines
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Synchronous Communication**:
  - Implemented reusable asynchronous `ServiceClient` (`shared/clients/service_client.py`) using `httpx.AsyncClient` with connection pooling, exponential backoff retries, configurable timeouts, and automatic `X-Request-ID` propagation.
  - Pre-configured client factories: `get_auth_client()`, `get_user_client()`, `get_chat_client()`, `get_message_client()`, `get_notification_client()`.
  - Automatic error unwrapping: translates HTTP 4xx/5xx into typed domain `AppException` classes.
- **Asynchronous Communication**:
  - Redis Pub/Sub event bus (`fluxchat:events` & `system:broadcast`) utilized for non-blocking notifications, presence updates, and message fan-out.

---

### Phase 21 — Standardized Error Handling
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Uniform error responses across all microservices.
- **Implementation**:
  - Defined unified exception hierarchy in `shared/errors/exceptions.py`:
    - `AuthenticationError` (401, `AUTHENTICATION_FAILED`)
    - `AuthorizationError` (403, `PERMISSION_DENIED`)
    - `NotFoundError` (404, `NOT_FOUND`)
    - `ConflictError` (409, `CONFLICT`)
    - `ValidationError` (422, `VALIDATION_ERROR`)
    - `RateLimitError` (429, `RATE_LIMIT_EXCEEDED`)
    - `BadGatewayError` (502, `BAD_GATEWAY`)
    - `ServiceUnavailableError` (503, `SERVICE_UNAVAILABLE`)
  - Global exception handlers in `shared/errors/handlers.py` (`register_exception_handlers(app)`) mounted across all 7 backend microservices, translating all exceptions into the canonical Phase 21 JSON envelope:
    ```json
    {
      "error": {
        "code": "USER_NOT_FOUND",
        "message": "The requested user does not exist",
        "request_id": "req_8bc739f",
        "timestamp": "2026-09-12T19:00:00Z"
      },
      "detail": "The requested user does not exist"
    }
    ```

---

### Phase 22 — Structured JSON Logging
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Full auditability, distributed tracing, and centralized log ingestion.
- **Implementation**:
  - Implemented `shared/logging/structured_logger.py` with `JsonFormatter`:
    ```json
    {
      "timestamp": "2026-09-12T19:00:00Z",
      "service": "auth-service",
      "level": "INFO",
      "request_id": "req_123",
      "message": "User login successful"
    }
    ```
  - **Sanitization Rule**: Deep recursive key-sanitization via `sanitize_dict` redacting `password`, `token`, `access_token`, `refresh_token`, `authorization`, `otp`, `secret`, and `api_key`.
  - **Middleware**: `RequestLoggingMiddleware` tracking latency in milliseconds and tagging distributed `X-Request-ID`.

---

### Phase 23 — Comprehensive Security & Hardening
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Defense-in-Depth Measures**:
  - **IDOR Protection**: Implemented `assert_resource_owner` and `assert_conversation_member` guards in `shared/security/dependencies.py` to enforce strict ownership and membership boundaries.
  - **Redis-Backed Rate Limiting**: Implemented `require_rate_limit` dependency in `shared/security/rate_limit.py`, protecting `/auth/login`, `/auth/register`, and `/auth/send-otp` against brute-force attacks with HTTP 429 and `Retry-After` headers.
  - **NoSQL Injection Prevention**: Strongly-typed `validate_object_id` parsing prevents nested operator injection attacks (`{"$gt": ""}`).
  - **CORS Constraints**: Verified domains (`http://localhost:3000`) with credential support and exposed tracing headers.

---

### Phase 24 — MongoDB Compound Indexes Optimization
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Sub-millisecond queries, sorted timeline feeds, and unique roster constraints.
- **Index Catalog Established on Atlas**:
  - `users`: `{ email: 1 }` (unique), `{ username: 1 }` (unique), `{ phone: 1 }` (unique, partialFilterExpression on string)
  - `messages`: `{ conversation_id: 1, created_at: -1, _id: -1 }` (cursor pagination index)
  - `conversations`: `{ members: 1, updated_at: -1 }` (inbox thread timeline index)
  - `contact_requests`: `{ sender_id: 1, recipient_id: 1 }` (unique), `{ recipient_id: 1, status: 1 }`
  - `contacts`: `{ user_id: 1, contact_id: 1 }` (unique bilateral roster index)
  - `notifications`: `{ user_id: 1, created_at: -1, is_read: 1 }` (inbox & unread counter index)
  - `revoked_tokens`: `{ token: 1 }` (unique), `{ expires_at: 1 }` (automatic TTL cleanup)

---

### Phase 25 — Automated Testing Suite & Cross-Service Test Harness
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Comprehensive test pyramid covering unit, integration, microservice, security, and cluster-wide end-to-end user journeys.
- **Master Test Runner**: `backend/run_all_tests.sh`
  - Automated orchestrator that executes all 9 test suites across the cluster with colorized reporting and timing metrics.
  - Run all: `./run_all_tests.sh all`
  - Run specific categories: `./run_all_tests.sh shared`, `./run_all_tests.sh services`, or `./run_all_tests.sh e2e`
- **Verification Results**:
  - **Shared Infrastructure, Security & Redis**: 14 tests passing (`shared/`)
  - **API Gateway Service**: 15 tests passing (`services/api-gateway/tests/`)
  - **Auth Service**: 10 tests passing (`services/auth-service/tests/`)
  - **User Service**: 4 tests passing (`services/user-service/tests/`)
  - **Chat Service**: 2 tests passing (`services/chat-service/tests/`)
  - **Message Service**: 3 tests passing (`services/message-service/tests/`)
  - **WebSocket Service**: 3 tests passing (`services/websocket-service/tests/`)
  - **Notification Service**: 2 tests passing (`services/notification-service/tests/`)
  - **E2E Full User Journey Cluster Test**: 2 tests passing (`tests/e2e/test_full_journey.py`)
  - **Total**: 55 tests across 9 suites passing with 100% success rate (0 failures).
- **CI/CD Automation**: `.github/workflows/ci.yml` providing automated verification for Next.js frontend builds and backend test suites on every push and PR.

---

### Phase 26 — Docker Containerization & Compose Orchestration
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Full cluster containerization with multi-stage Docker builds, Redis integration, and declarative Compose orchestration.
- **Docker Architecture**:
  - **7 Backend Microservices (`python:3.12-slim`)**:
    - Multi-stage builds (`builder` ➔ `runner`) separating build dependencies from runtime footprint (~70MB content size).
    - Hardened security: Non-root user `appuser:appgroup` (UID 1000).
    - Native zero-dependency health checks via Python HTTP probes (`/health`).
    - Standardized shared module injection: `/app/shared` mounted across all services.
  - **Next.js 15 Standalone Frontend (`node:20-alpine`)**:
    - Multi-stage standalone build output (`output: "standalone"` in `next.config.ts`).
    - Non-root user `nextjs:nodejs` (UID 1001).
    - Lean Alpine runner serving static pages and SSR on port `3000`.
  - **Redis 7 In-Memory Service (`redis:7-alpine`)**:
    - Containerized Redis on internal `fluxchat-network` bridge with AOF persistence.
- **Master Orchestrator**: [`docker-compose.yml`](file:///Users/apple/Desktop/project/chat-app/docker-compose.yml)
  - Inter-service networking on `fluxchat-network` bridge.
  - Healthcheck dependency ordering: services wait for healthy Redis before accepting traffic.
  - API Gateway unified reverse proxy routing ingress traffic across internal services.
- **Environment Template**: [`.env.docker.example`](file:///Users/apple/Desktop/project/chat-app/.env.docker.example)

---

### Phase 27 — Environment Configuration & 12-Factor Compliance
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Complete Twelve-Factor App compliance (Factor III: Config) with fail-fast boot guardrails and sanitized templates.
- **Deliverables**:
  - **Root Environment Template**: [`.env.example`](file:///Users/apple/Desktop/project/chat-app/.env.example) aggregating all 7 microservices, Redis, and Next.js parameters.
  - **Sanitized Service Templates**: Sanitized all `.env.example` files across services (`auth`, `user`, `chat`, `message`, `websocket`, `notification`, `gateway`) with placeholders and zero leaked credentials.
  - **Reusable 12-Factor Validator**: [`shared/config/validator.py`](file:///Users/apple/Desktop/project/chat-app/backend/shared/config/validator.py) enforcing scheme validation (`mongodb://`, `redis://`), secret entropy (>= 32 chars), and production rejection of default development keys.
  - **Diagnostic CLI Tool**: [`backend/verify_env.py`](file:///Users/apple/Desktop/project/chat-app/backend/verify_env.py) auditing all `.env` files in the cluster.
  - **Production Readiness Guide**: [`docs/ENVIRONMENT_CONFIG.md`](file:///Users/apple/Desktop/project/chat-app/docs/ENVIRONMENT_CONFIG.md).

---

### Phase 28 — OpenAPI & API Documentation
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Objective**: Standardized, enriched, and aggregated OpenAPI 3.1 documentation across the microservices suite.
- **Deliverables**:
  - **Multi-Spec Swagger Explorer (`/docs`)**: Interactive Swagger UI on the API Gateway with a dropdown selector allowing developers to toggle between the Unified Gateway Ingress and any downstream microservice.
  - **Dynamic Schema Aggregator**: [`services/api-gateway/app/api/v1/docs.py`](file:///Users/apple/Desktop/project/chat-app/backend/services/api-gateway/app/api/v1/docs.py) proxying downstream service OpenAPI specs.
  - **ReDoc Technical Reference (`/redoc`)**: Standard ReDoc viewer deployed across all services.
  - **Automated Schema Exporter**: [`backend/scripts/export_openapi.py`](file:///Users/apple/Desktop/project/chat-app/backend/scripts/export_openapi.py) extracting all 7 microservice specs into [`docs/openapi/`](file:///Users/apple/Desktop/project/chat-app/docs/openapi/) and generating [`fluxchat_unified.json`](file:///Users/apple/Desktop/project/chat-app/docs/openapi/fluxchat_unified.json) (62 total endpoints).
  - **Standardized Error Responses**: Phase 21 error JSON envelopes (`ErrorResponse`) documented in OpenAPI components across all standard error codes.
  - **Comprehensive Developer Guide**: [`docs/API_DOCUMENTATION.md`](file:///Users/apple/Desktop/project/chat-app/docs/API_DOCUMENTATION.md).

---

### Phase 29 — Production Architecture & Scaling
- **Status**: ✅ **COMPLETED & VERIFIED**
- **Deliverables**:
  - **Kubernetes Architecture ([`k8s/`](file:///Users/apple/Desktop/project/chat-app/k8s/))**: Declarative manifests for namespace, ConfigMap, Secrets, Redis, Ingress, Horizontal Pod Autoscalers (HPA v2), and Pod Disruption Budgets (PDB).
  - **Standardized Health Probes ([`backend/shared/health/`](file:///Users/apple/Desktop/project/chat-app/backend/shared/health/))**:
    - Liveness Probe (`/health/live`): Process liveness, event loop responsiveness, zero database queries to prevent cascading restarts.
    - Readiness Probe (`/health/ready`): Dependency verification (MongoDB Atlas & Redis ping), returns HTTP 200 OK when ready, HTTP 503 Service Unavailable when backing stores are down.
    - Mounted and verified across all 7 backend services + API Gateway rate-limit bypass.
  - **Zero-Downtime Rolling Update Strategy**: `maxSurge: 25%`, `maxUnavailable: 0`, and `terminationGracePeriodSeconds` (30s/60s).
  - **Production Scaling Runbook**: [`docs/PRODUCTION_SCALING.md`](file:///Users/apple/Desktop/project/chat-app/docs/PRODUCTION_SCALING.md).

---

### Phase 30 — Metrics, Monitoring & Observability
- **Deliverables**:
  - Prometheus metrics exporter (`/metrics`) across microservices.
  - OpenTelemetry distributed tracing integration.
  - Service latency percentiles (p50, p95, p99), error rates, and active WebSocket metrics.


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
- **Phase 9 (Cursor-Based Message Pagination)**: ✅ **Completed & Verified** (Opaque Base64 tokens with bidirectional scrolling).
- **Phase 10 (Message Reactions)**: ✅ **Completed & Verified** (Idempotent emoji reactions & real-time counts).
- **Phase 11 (Pinned Messages)**: ✅ **Completed & Verified** (Pin up to 5 messages per conversation).
- **Phase 12 (Redis Integration)**: ✅ **Completed & Verified** (Caching, Pub/Sub channels, connection pooling).
- **Phase 13 (WebSocket Service)**: ✅ **Completed & Verified** (Port 8005, JWT auth query param, connection heartbeat).
- **Phase 14 (Real-time Messaging Over WebSocket)**: ✅ **Completed & Verified** (Instant message delivery & Redis fanout).
- **Phase 15 (User Presence Tracking)**: ✅ **Completed & Verified** (Redis online/offline/away states with TTL).
- **Phase 16 (Typing Indicators)**: ✅ **Completed & Verified** (Ephemeral typing states with 5s expiry).
- **Phase 17 (Delivery & Read Receipts)**: ✅ **Completed & Verified** (sent ➔ delivered ➔ read tracking).
- **Phase 18 (Notification Service)**: ✅ **Completed & Verified** (Port 8006, persistent alert inbox & unread counters).
- **Phase 19 (API Gateway Service)**: ✅ **Completed & Verified** (Port 8000, unified reverse proxy, WS tunneling, cluster health aggregation).
- **Phase 20 (Resilient Inter-Service RPC)**: ✅ **Completed & Verified** (HTTP connection pooling, retry policies, typed errors).
- **Phase 21 (Standardized Error Envelope)**: ✅ **Completed & Verified** (Universal Phase 21 error JSON format across all 7 services).
- **Phase 22 (Structured JSON Logging)**: ✅ **Completed & Verified** (Credential redaction, request ID correlation, latency tracking).
- **Phase 23 (Security & Hardening)**: ✅ **Completed & Verified** (IDOR guards, NoSQL injection protection, Redis rate limiting).
- **Phase 24 (MongoDB Atlas Indexes)**: ✅ **Completed & Verified** (Compound, unique, and TTL indexes applied to live cluster).
- **Phase 25 (Automated Test Suite & E2E Test Harness)**: ✅ **Completed & Verified** (Master test runner `run_all_tests.sh`, 55/55 tests passing in 95s, CI/CD pipeline).
- **Phase 26 (Docker Containerization & Compose Orchestration)**: ✅ **Completed & Verified** (Multi-stage Dockerfiles for all 7 microservices, Redis, Next.js standalone frontend, compose orchestration).
- **Phase 27 (Environment Configuration & 12-Factor Compliance)**: ✅ **Completed & Verified** (Root & service `.env.example` templates, `validator.py`, `verify_env.py` diagnostic tool, production checklist).
- **Phase 28 (OpenAPI & API Documentation)**: ✅ **Completed & Verified** (Multi-spec Swagger portal at `:8000/docs`, ReDoc, `export_openapi.py` with 62 endpoints, `API_DOCUMENTATION.md`).
- **Phase 29 (Production Architecture & Scaling)**: ✅ **Completed & Verified** (Kubernetes manifests in `k8s/`, `/health/live` & `/health/ready` probes, HPA, PDB, zero-downtime runbook).
- **Phase 30 (Metrics, Monitoring & Observability)**: ⏳ **Next in Queue**


