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
- **Status**: ⏳ **IN PROGRESS / NEXT**
- **Objective**: Implement user registration, secure credential verification, and JWT session handling.
- **Architecture**:
  ```text
  Client ──> AuthRouter ──> AuthService ──> PasswordHasher / JWTService
                                │
                                ▼
                         AuthRepository ──> MongoDB Atlas (users collection)
  ```
- **Step-by-Step Implementation**:
  1. **PasswordHasher (`core/security.py`)**:
     - Implement secure bcrypt password hashing (`bcrypt.hashpw`, `bcrypt.checkpw`) with work factor >= 12.
     - Never store or log plaintext passwords.
  2. **JWTService (`core/jwt.py`)**:
     - Generate signed JWT Access Tokens (expiration: 15 minutes, payload: `sub` [user_id], `email`, `username`, `type: "access"`).
     - Generate signed JWT Refresh Tokens (expiration: 30 days, payload: `sub` [user_id], `type: "refresh"`).
     - Token verification, decode validation, and expiration exception handling.
  3. **Data Schemas (`schemas/auth.py`)**:
     - `UserRegisterRequest`: `{ name, username, email, password }`
     - `UserLoginRequest`: `{ email_or_username, password }`
     - `TokenResponse`: `{ access_token, refresh_token, token_type: "Bearer", expires_in: 900 }`
     - `TokenRefreshRequest`: `{ refresh_token }`
     - `UserResponse`: `{ id, name, username, email, avatar, bio, created_at }`
  4. **Database Model (`models/user.py`)**:
     ```python
     {
       "_id": ObjectId,
       "name": str,
       "username": str,         # unique index
       "email": str,            # unique index
       "password_hash": str,
       "avatar": Optional[str],
       "bio": Optional[str],
       "is_active": bool,
       "created_at": datetime,
       "updated_at": datetime
     }
     ```
  5. **Repository Layer (`repositories/auth_repository.py`)**:
     - `create_user(user_data)`: Insert user document into `users` collection.
     - `find_by_email(email)`: Query user by case-insensitive email.
     - `find_by_username(username)`: Query user by case-insensitive username.
     - `find_by_id(user_id)`: Query user by `ObjectId`.
  6. **Service Layer (`services/auth_service.py`)**:
     - `register()`: Check duplicate email/username, hash password, create user, return sanitized `UserResponse`.
     - `login()`: Verify user exists, verify password hash, generate token pair.
     - `refresh()`: Validate refresh token, verify user active, issue fresh access token.
     - `logout()`: Revoke token session.
  7. **API Endpoints (`api/v1/auth.py`)**:
     - `POST /api/v1/auth/register` (201 Created)
     - `POST /api/v1/auth/login` (200 OK)
     - `POST /api/v1/auth/refresh` (200 OK)
     - `POST /api/v1/auth/logout` (200 OK)
     - `GET  /api/v1/auth/me` (200 OK)
  8. **Automated Testing (`tests/test_auth.py`)**:
     - Test valid registration, duplicate email rejection (409 Conflict), valid login, invalid password rejection (401 Unauthorized), token refresh, and `/me` profile retrieval.

---

### Phase 4 — Authorization & Security Dependencies
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
  1. Create `core/dependencies.py` with `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")`.
  2. Implement `get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse`.
  3. Validate token type is `"access"`. Reject refresh tokens on protected routes.
  4. Raise `HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})`.
  5. Implement role/permission guards: `require_admin()` for future group/admin actions.
  6. Protect `GET /api/v1/auth/me` using `Depends(get_current_user)`.

---

### Phase 5 — User Service
- **Objective**: Manage user profiles, avatars, bios, online presence flags, and user search.
- **Architecture**:
  ```text
  UserRouter ──> UserService ──> UserRepository ──> MongoDB (users collection)
  ```
- **Step-by-Step Implementation**:
  1. Scaffold `services/user-service/` with modular `api/`, `core/`, `schemas/`, `services/`, and `repositories/`.
  2. Define schemas:
     - `UserProfileUpdate`: `{ name?, bio?, avatar? }`
     - `UserProfileResponse`: `{ id, name, username, email, avatar, bio, is_online, last_seen, created_at }`
     - `UserSearchResult`: `{ items: List[UserProfileResponse], total: int }`
  3. Implement `UserRepository`:
     - `update_profile(user_id, update_data)`
     - `search_users(query, limit, skip)`: Regex search on `username`, `name`, and `email`.
  4. Implement `UserService`:
     - Validate allowed fields on update.
     - Format public profile view.
  5. Endpoints:
     - `GET   /api/v1/users/me` — Authenticated user's profile.
     - `PATCH /api/v1/users/me` — Update display name, bio, or avatar.
     - `GET   /api/v1/users/{user_id}` — View any user's public profile.
     - `GET   /api/v1/users/search?q={query}` — Search users for contacts or groups.

---

### Phase 6 — Contacts Management
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
       "status": "pending | accepted | rejected",
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
  3. Endpoints:
     - `POST   /api/v1/contacts/requests` — Send request `{ recipient_id }`. Prevents self-request.
     - `GET    /api/v1/contacts/requests` — List received and sent requests with sender info.
     - `POST   /api/v1/contacts/requests/{id}/accept` — Accept request and insert bidirectional contact entries.
     - `POST   /api/v1/contacts/requests/{id}/reject` — Reject request.
     - `DELETE /api/v1/contacts/{contact_id}` — Remove contact from roster.
     - `GET    /api/v1/contacts` — List all contacts with online presence metadata.
  4. Security: Enforce that only the target `recipient_id` can accept or reject a request.

---

### Phase 7 — Chat & Conversation Service
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
     - `find_direct_conversation(user_a, user_b)`: Avoid duplicate direct chats between two users.
     - `find_user_conversations(user_id)`: Index `{ members: 1, updated_at: -1 }`.
     - `create_conversation()`, `add_member()`, `remove_member()`.
  3. Endpoints:
     - `POST   /api/v1/conversations` — Start 1:1 chat or create group.
     - `GET    /api/v1/conversations` — List conversations current user is a member of.
     - `GET    /api/v1/conversations/{id}` — Detailed conversation data with member list.
     - `PATCH  /api/v1/conversations/{id}` — Update group name or avatar (Admin only).
     - `DELETE /api/v1/conversations/{id}` — Delete group (Admin only) or leave chat.
     - `POST   /api/v1/conversations/{id}/members` — Add members to group.
     - `DELETE /api/v1/conversations/{id}/members/{user_id}` — Remove member from group (Admin only).
     - `POST   /api/v1/conversations/{id}/leave` — Voluntarily leave conversation.

---

### Phase 8 — Message Service
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
     - `create_message(data)`
     - `get_messages_by_conversation(conv_id, limit, cursor)`
     - `update_message(msg_id, sender_id, new_content)`
     - `soft_delete_message(msg_id, sender_id)`
  3. Endpoints:
     - `POST   /api/v1/conversations/{id}/messages` — Send message (verifies caller is a conversation member).
     - `GET    /api/v1/conversations/{id}/messages` — Retrieve conversation message thread.
     - `PATCH  /api/v1/messages/{id}` — Edit message (author only, sets `edited: true`).
     - `DELETE /api/v1/messages/{id}` — Soft delete (author only, replaces content with "This message was deleted").
     - `POST   /api/v1/messages/{id}/read` — Mark message as read.

---

### Phase 9 — Cursor-Based Message Pagination
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
    "next_cursor": "eyJjcmVhdGVkX2F0IjoxNzQwMDAwLCJpZCI6IjY3..."
  }
  ```

---

### Phase 10 — Frontend REST Integration
- **Objective**: Sequentially swap out frontend mock data with live FastAPI backend calls.
- **Sequence**:
  1. **Auth Integration**: Update Next.js `lib/api/auth.ts` to call `/api/v1/auth/login` and `/api/v1/auth/register`. Store JWT token in secure cookies/localStorage.
  2. **Profile & Settings**: Fetch `/api/v1/users/me` on dashboard load.
  3. **Contacts**: Wire `/api/v1/contacts` to Contacts view (`app/app/contacts/page.tsx`).
  4. **Chat List**: Wire `/api/v1/conversations` to Conversation list sidebar.
  5. **Message Thread**: Wire `/api/v1/conversations/{id}/messages` to active chat view.

---

### Phase 11 — WebSocket Service
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

---

### Phase 12 — WebSocket Event Protocol
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
- **Event Catalog**:
  - `message.new` — Broadcast newly sent message to all room members.
  - `message.updated` — Broadcast message edit.
  - `message.deleted` — Broadcast message deletion.
  - `message.delivered` — Delivery receipt acknowledgment.
  - `message.read` — Read receipt update.
  - `typing.start` / `typing.stop` — Ephemeral typing notification.
  - `user.online` / `user.offline` — Presence updates.

---

### Phase 13 — Redis Foundation (Pub/Sub & Caching)
- **Objective**: Connect Redis to enable horizontal scaling and distributed event broadcasting.
- **Architecture**:
  ```text
  WebSocket Service 1 ──┐
                        ├──> Redis Pub/Sub (channel: conversation:{id})
  WebSocket Service 2 ──┘
  ```
- **Implementation**:
  - Connect to Redis using `redis-py` (asyncio).
  - Subscribe WebSocket workers to relevant conversation channels.
  - Publish message events to Redis; all workers holding recipient sockets receive and forward frames.

---

### Phase 14 — End-to-End Real-Time Message Flow
- **Objective**: Complete end-to-end pipeline from client input to DB persistence and live socket push.
- **Step-by-Step Flow**:
  1. User A types message in frontend and sends via WebSocket frame.
  2. WebSocket Service validates frame and calls Message Service.
  3. Message Service persists document in MongoDB Atlas.
  4. Message Service publishes `message.new` to Redis Pub/Sub channel.
  5. Redis broadcasts event to all subscribed WebSocket instances.
  6. Recipient's WebSocket instance pushes frame to User B's open socket.
  7. If User B is offline, Notification Service receives Redis event and enqueues notification.

---

### Phase 15 — Online Presence System
- **Objective**: Track user availability accurately without database writes.
- **Implementation**:
  - Store online status in Redis: `presence:{user_id} -> "online"`.
  - On socket connect: increment user connection counter in Redis. If count == 1, publish `user.online`.
  - On socket disconnect: decrement counter. If count == 0, wait 15s grace period (for tab refreshes). If still 0, publish `user.offline` and set `last_seen` timestamp in MongoDB.

---

### Phase 16 — Ephemeral Typing Indicators
- **Objective**: Instant typing indicators without database load.
- **Implementation**:
  - User starts typing ➔ frontend emits `{ "event": "typing.start", "conversation_id": "c1" }`.
  - Store ephemeral key in Redis: `typing:{conv_id}:{user_id}` with `EXPIRE 4`.
  - Broadcast event to conversation channel via Redis.
  - After 4s without input, or on `{ "event": "typing.stop" }`, broadcast typing stopped.

---

### Phase 17 — Delivery & Read Receipts
- **Objective**: Track `sent`, `delivered`, and `read` statuses.
- **Implementation**:
  - Message sent ➔ saved in MongoDB as `"sent"`.
  - Recipient socket receives message ➔ emits `message.delivered` ➔ MongoDB status updated to `"delivered"`.
  - Recipient views message in viewport ➔ emits `message.read` with message IDs ➔ batch update status in MongoDB to `"read"` ➔ sender receives `message.read` event and UI turns blue (`✓✓`).

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
- **Phase 3 (Authentication Service)**: ⏳ **Next in Queue**
