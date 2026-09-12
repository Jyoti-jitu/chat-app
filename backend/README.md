# FluxChat Backend — Distributed Microservices Architecture

FluxChat Backend is a production-grade, modular microservice ecosystem engineered with **FastAPI**, **MongoDB Atlas (PyMongo Async / Motor)**, **Redis Pub/Sub**, and **WebSockets**.

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

## 📐 Core Architectural Principles

1. **Strict Separation of Concerns**:
   ```text
   Router (HTTP / WebSockets API Contract)
      ↓
   Service (Pure Business Logic & Domain Validation)
      ↓
   Repository (Data Access Object & Database Queries)
      ↓
   MongoDB Atlas (Motor Async Client)
   ```
   - *Rule*: Route handlers never execute raw database queries.
   - *Rule*: Services never manipulate raw MongoDB cursors.

2. **Isolated Repository Pattern**:
   - Every domain collection has a dedicated repository (`AuthRepository`, `UserRepository`, `ConversationRepository`, `MessageRepository`).
   - Mockable and testable without requiring an active database connection.

3. **Pydantic Schemas vs. Database Models**:
   - Internal MongoDB documents (`_id`, password hashes) are never returned directly to API clients.
   - Pydantic models validate input requests and shape outward JSON responses.

4. **MongoDB ObjectId Abstraction**:
   - Internal `ObjectId` is converted to clean string `id` fields in external API contracts.

5. **Stateless Authentication with Asymmetric / HMAC JWT**:
   - Short-lived Access Tokens (15 min) for authorized requests.
   - Long-lived Refresh Tokens (30 days) stored securely to regenerate access credentials.

6. **12-Factor App Configuration**:
   - Zero hardcoded credentials. All secrets load dynamically from `.env` via `pydantic-settings`.

---

## 🗺️ Detailed Phase-by-Phase Roadmap (Phases 1 — 29)

### Phase 1 — FastAPI Backend Foundation
- **Objective**: Scaffold the initial microservice (`services/auth-service/`) with production foundations.
- **Key Deliverables**:
  - FastAPI application with lifespan management (`asynccontextmanager`).
  - Pydantic Settings configuration (`core/config.py`).
  - Structured logging pipeline (`core/logging.py`).
  - CORS middleware supporting Next.js (`http://localhost:3000`).
  - Standardized health check endpoints (`GET /` and `GET /health`).
  - Automated tests with `pytest`.
- **Status**: ✅ **COMPLETED**

---

### Phase 2 — MongoDB Foundation
- **Objective**: Establish the shared asynchronous MongoDB connection layer.
- **Key Deliverables**:
  - Shared database manager (`shared/database/mongodb.py`) using `motor.motor_asyncio`.
  - Live connection to **MongoDB Atlas** (`mongodb+srv://...`).
  - Startup connection ping validation and graceful shutdown hooks.
  - Centralized index management infrastructure (`shared/database/indexes.py`).
  - Health check upgrade returning:
    ```json
    { "status": "ok", "database": "connected" }
    ```
- **Status**: ✅ **COMPLETED**

---

### Phase 3 — Authentication Service
- **Objective**: Implement user registration, credential verification, and JWT session handling.
- **Key Deliverables**:
  - **Password Hashing**: Secure one-way hashing with `bcrypt` (salt rounds >= 12).
  - **JWT Service**: Issue HMAC-SHA256 signed Access Tokens and Refresh Tokens.
  - **Data Access Layer**: `AuthRepository` managing user persistence in MongoDB `users` collection.
  - **Business Logic**: `AuthService` handling duplicate checks, password verification, and token rotation.
  - **API Endpoints**:
    - `POST /api/v1/auth/register` — Create account with name, username, email, and password.
    - `POST /api/v1/auth/login` — Authenticate credentials and return access + refresh tokens.
    - `POST /api/v1/auth/refresh` — Issue fresh access token using valid refresh token.
    - `POST /api/v1/auth/logout` — Invalidate refresh token session.
    - `GET  /api/v1/auth/me` — Retrieve identity of authenticated user.
  - **Database Indexes**: Unique index on `users.email` and `users.username`.

---

### Phase 4 — Authorization & Security Dependencies
- **Objective**: Create reusable FastAPI security dependencies for endpoint protection.
- **Key Deliverables**:
  - `get_current_user` dependency validating `Authorization: Bearer <token>`.
  - Differentiated error responses:
    - `401 Unauthorized`: Missing, expired, or malformed JWT token.
    - `403 Forbidden`: Insufficient role or accessing resources belonging to another user.
  - Token blacklisting and session revocation verification.

---

### Phase 5 — User Service
- **Objective**: Profile management, user discovery, and status representation.
- **Key Deliverables**:
  - Independent service: `services/user-service/`.
  - `UserRepository` and `UserService`.
  - **API Endpoints**:
    - `GET   /api/v1/users/me` — Get full personal profile.
    - `PATCH /api/v1/users/me` — Update display name, bio, avatar URL, or settings.
    - `GET   /api/v1/users/{user_id}` — Public profile lookup.
    - `GET   /api/v1/users/search?q={query}` — Search users by username, email, or name.

---

### Phase 6 — Contacts Management
- **Objective**: Manage bidirectional connection requests and personal contact rosters.
- **Key Deliverables**:
  - **Collection**: `contact_requests` and `contacts`.
  - **API Endpoints**:
    - `POST   /api/v1/contacts/requests` — Send a connection request to another user.
    - `GET    /api/v1/contacts/requests` — List pending incoming & outgoing requests.
    - `POST   /api/v1/contacts/requests/{id}/accept` — Accept request & establish mutual connection.
    - `POST   /api/v1/contacts/requests/{id}/reject` — Decline contact request.
    - `DELETE /api/v1/contacts/{user_id}` — Remove an existing contact.
    - `GET    /api/v1/contacts` — Fetch full contacts roster with online presence flag.
  - **Access Control**: Users can only accept/reject requests targeted at themselves.

---

### Phase 7 — Chat & Conversation Service
- **Objective**: Conversation lifecycles, member rosters, and metadata management.
- **Key Deliverables**:
  - Independent service: `services/chat-service/`.
  - Support for `direct` (1:1) and `group` conversations.
  - **Document Structure**:
    ```json
    {
      "_id": "ObjectId",
      "type": "direct | group",
      "name": "Team Squad",
      "avatar": "https://...",
      "members": ["user_id_1", "user_id_2"],
      "admins": ["user_id_1"],
      "last_message_id": "msg_id",
      "created_at": "ISO Date",
      "updated_at": "ISO Date"
    }
    ```
  - **API Endpoints**:
    - `POST   /api/v1/conversations` — Start a direct chat or create a new group.
    - `GET    /api/v1/conversations` — List conversations the authenticated user belongs to.
    - `GET    /api/v1/conversations/{id}` — Get detailed conversation metadata & member roster.
    - `PATCH  /api/v1/conversations/{id}` — Update group title, avatar, or description (Admins).
    - `DELETE /api/v1/conversations/{id}` — Delete group (Owner/Admin) or remove conversation.
    - `POST   /api/v1/conversations/{id}/members` — Add members to a group.
    - `DELETE /api/v1/conversations/{id}/members/{user_id}` — Remove member from group.
    - `POST   /api/v1/conversations/{id}/leave` — Voluntarily leave group.

---

### Phase 8 — Message Service
- **Objective**: Message lifecycle, rich message types, replies, and status tracking.
- **Key Deliverables**:
  - Independent service: `services/message-service/`.
  - **Message Types**: `text`, `image`, `file`, `audio`, `system`.
  - **Document Structure**:
    ```json
    {
      "_id": "ObjectId",
      "conversation_id": "conv_id",
      "sender_id": "user_id",
      "content": "Hello team!",
      "type": "text",
      "attachment": null,
      "reply_to": "parent_msg_id",
      "status": "sent | delivered | read",
      "edited": false,
      "deleted": false,
      "created_at": "ISO Date",
      "updated_at": "ISO Date"
    }
    ```
  - **API Endpoints**:
    - `POST   /api/v1/conversations/{conv_id}/messages` — Post a message.
    - `GET    /api/v1/conversations/{conv_id}/messages` — Fetch message history.
    - `PATCH  /api/v1/messages/{message_id}` — Edit message content.
    - `DELETE /api/v1/messages/{message_id}` — Soft-delete message.
    - `POST   /api/v1/messages/{message_id}/read` — Mark message as read.

---

### Phase 9 — Cursor-Based Message Pagination
- **Objective**: High-performance, scalable infinite scrolling message retrieval.
- **Key Deliverables**:
  - Never return unbounded message arrays.
  - Implement cursor pagination using `created_at` timestamp + `_id`.
  - **Query Pattern**:
    `GET /api/v1/conversations/{id}/messages?limit=30&cursor=eyJjcmVhdGVkX2F0...`
  - **Response Format**:
    ```json
    {
      "items": [...],
      "next_cursor": "base64_encoded_cursor_string",
      "has_more": true
    }
    ```
  - **MongoDB Compound Index**: `(conversation_id ASC, created_at DESC)`.

---

### Phase 10 — Frontend REST Integration
- **Objective**: Progressively connect the Next.js frontend to real FastAPI backend endpoints.
- **Key Deliverables**:
  - Replace mock datasets step-by-step:
    1. Phone & Email Authentication / JWT Session Storage.
    2. User profile retrieval & editing (`/app/profile`).
    3. Contacts directory & requests (`/app/contacts`).
    4. Conversation lists & group creation (`/app/chats`, `/app/groups`).
    5. Message threads & cursor scrolling.
  - Maintain graceful fallback mechanisms during migration.

---

### Phase 11 — WebSocket Service & Connection Lifecycle
- **Objective**: Establish persistent, low-latency, bidirectional real-time channels.
- **Key Deliverables**:
  - Independent service: `services/websocket-service/`.
  - **Endpoint**: `/ws?token=<jwt_access_token>`.
  - **Authentication**: Validate JWT on the WebSocket upgrade handshake. Derives `user_id` strictly from token payload (never trust client-supplied identity).
  - In-memory connection manager tracking active client sockets per user.

---

### Phase 12 — WebSocket Event Protocol
- **Objective**: Standardize strongly-typed JSON envelope for all real-time events.
- **Envelope Specification**:
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
  - Messages: `message.new`, `message.updated`, `message.deleted`
  - Receipts: `message.delivered`, `message.read`
  - Ephemeral: `typing.start`, `typing.stop`
  - Presence: `user.online`, `user.offline`

---

### Phase 13 — Redis Foundation (Pub/Sub & Caching)
- **Objective**: Introduce Redis as a distributed message broker and ephemeral memory store.
- **Key Deliverables**:
  - Connect to Redis via `redis-py` (asyncio).
  - Enable horizontal scaling: Multiple WebSocket service instances subscribe to Redis channels (`channel:conversation:{id}`, `channel:user:{id}`).
  - Redis acts as the real-time distribution fabric; MongoDB remains the source of truth for persistent records.

---

### Phase 14 — End-to-End Real-Time Message Flow
- **Objective**: Seamless flow from sender socket to persistence and recipient delivery.
- **Architecture Flow**:
  ```text
  User A Socket
       │
       ▼
  WebSocket Service (Validates Token & Payload)
       │
       ▼
  Message Service (Persists message in MongoDB Atlas)
       │
       ▼
  Redis Pub/Sub (Broadcasts to 'conv:{id}' channel)
       │
       ▼
  WebSocket Service (All instances holding recipient sockets)
       │
       ▼
  User B Socket (Receives 'message.new' event)
  ```

---

### Phase 15 — Online Presence System
- **Objective**: Accurate tracking of user online/offline status and last seen timestamps.
- **Key Deliverables**:
  - Track presence keys in Redis: `presence:{user_id}`.
  - Support multiple simultaneous connections per user (e.g., mobile + desktop).
  - Trigger `user.online` on first connection; trigger `user.offline` only when the last active socket disconnects.
  - Heartbeat ping/pong with 60-second TTL to handle abrupt network disconnects.

---

### Phase 16 — Ephemeral Typing Indicators
- **Objective**: Real-time typing indicators with zero database overhead.
- **Key Deliverables**:
  - Transient events: `typing.start` and `typing.stop`.
  - Cached in Redis with short TTL (4 seconds) to auto-expire without cluttering MongoDB.
  - Broadcast strictly to other members of the active conversation.

---

### Phase 17 — Delivery & Read Receipts
- **Objective**: WhatsApp-style delivery (`✓✓` grey) and read (`✓✓` primary) receipts.
- **Key Deliverables**:
  - Message status sequence: `sent` ➔ `delivered` ➔ `read`.
  - Client WebSocket emits `message.read` with `message_ids` when conversation is open in viewport.
  - Batch update status in MongoDB and publish status events via Redis.

---

### Phase 18 — Notification Service
- **Objective**: Event-driven notification dispatch for offline or background alerts.
- **Key Deliverables**:
  - Independent service: `services/notification-service/`.
  - Listens to Redis events (`message.created`, `contact.requested`, `group.invite`).
  - Persists notifications in `notifications` collection.
  - **Endpoints**:
    - `GET  /api/v1/notifications`
    - `POST /api/v1/notifications/{id}/read`
    - `POST /api/v1/notifications/read-all`
    - `DELETE /api/v1/notifications/{id}`
    - `DELETE /api/v1/notifications` (Clear all)

---

### Phase 19 — API Gateway
- **Objective**: Single entry point for all frontend traffic.
- **Key Deliverables**:
  - Directory: `gateway/`.
  - Centralized routing:
    - `/api/v1/auth/*` ➔ Auth Service (8001)
    - `/api/v1/users/*` ➔ User Service (8002)
    - `/api/v1/conversations/*` ➔ Chat Service (8003)
    - `/api/v1/messages/*` ➔ Message Service (8004)
    - `/ws` ➔ WebSocket Service (8005)
    - `/api/v1/notifications/*` ➔ Notification Service (8006)
  - Unified CORS, Request ID injection, and Rate Limiting.

---

### Phase 20 — Service-to-Service Communication
- **Objective**: Clear boundaries for synchronous vs. asynchronous inter-service workflows.
- **Rules**:
  - **Synchronous (HTTP via `httpx.AsyncClient`)**: Required when immediate blocking response is mandatory (e.g., token validation).
  - **Asynchronous (Redis Pub/Sub)**: Non-blocking events (e.g., presence updates, notification dispatch, metrics).

---

### Phase 21 — Standardized Error Handling
- **Objective**: Predictable, developer-friendly API error payloads.
- **Response Format**:
  ```json
  {
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Conversation with id c1 was not found",
      "details": null,
      "request_id": "req_abc123"
    }
  }
  ```
- **Custom Exceptions**: `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `ValidationError`.

---

### Phase 22 — Structured JSON Logging
- **Objective**: Observability and trace tracking across all microservices.
- **Log Format**:
  ```text
  {"timestamp": "...", "service": "auth-service", "level": "INFO", "request_id": "...", "user_id": "...", "message": "..."}
  ```
- **Sanitization**: Strictly redact passwords, JWT tokens, and authorization headers from logs.

---

### Phase 23 — Comprehensive Security & Hardening
- **Objective**: Defense-in-depth protection.
- **Key Deliverables**:
  - Protection against IDOR (Insecure Direct Object Reference).
  - Brute force protection on login via Redis sliding-window rate limiting.
  - MongoDB injection prevention via typed Pydantic models.
  - Strict payload size limits on file attachments.

---

### Phase 24 — MongoDB Index Optimization
- **Objective**: Query plan optimization and index consolidation on MongoDB Atlas.
- **Key Indexes**:
  - `users`: `{ email: 1 }` (unique), `{ username: 1 }` (unique)
  - `messages`: `{ conversation_id: 1, created_at: -1 }` (compound)
  - `conversations`: `{ members: 1, updated_at: -1 }` (compound)
  - `notifications`: `{ user_id: 1, created_at: -1, is_read: 1 }` (compound)

---

### Phase 25 — Automated Testing Suite
- **Objective**: High test coverage across unit, integration, and API layers.
- **Test Matrix**:
  - `tests/unit/`: Password hasher, JWT signer, schema validations.
  - `tests/integration/`: Repository layer against live MongoDB Atlas.
  - `tests/api/`: Endpoint contracts, HTTP status codes, and error conditions using `httpx.AsyncClient`.

---

### Phase 26 — Docker Containerization
- **Objective**: Production-ready container builds for every service.
- **Key Deliverables**:
  - Multi-stage `Dockerfile` for each microservice.
  - Root `docker-compose.yml` orchestrating API Gateway, microservices, and Redis.

---

### Phase 27 — Environment & Secret Management
- **Objective**: Unified `.env.example` templates and 12-factor configuration across all microservices.
- **Rule**: No secrets or connection strings in version control.

---

### Phase 28 — OpenAPI & API Documentation
- **Objective**: Fully documented interactive Swagger and ReDoc interfaces for every microservice and unified gateway.

---

### Phase 29 — Production Architecture & Horizontal Autoscaling
- **Objective**: Readiness probes, liveness probes, graceful zero-downtime reloads, and horizontal scaling capabilities.

---

## 🔌 Microservice Port Mapping Table

| Service | Port | Primary Database / Storage | Description |
|---|---|---|---|
| **API Gateway** | `8000` | None (Routing & Proxy) | Unified ingress proxy for frontend |
| **Auth Service** | `8001` | MongoDB Atlas (`users`) | Registration, Login, JWT verification |
| **User Service** | `8002` | MongoDB Atlas (`users`) | Profiles, settings, user search |
| **Chat Service** | `8003` | MongoDB Atlas (`conversations`) | Direct & group chat management |
| **Message Service**| `8004` | MongoDB Atlas (`messages`) | Message CRUD, pagination, replies |
| **WebSocket Svc** | `8005` | Redis (Sockets / PubSub) | Real-time events, presence, typing |
| **Notification Svc**| `8006`| MongoDB Atlas (`notifications`)| Notification center & alerts |
| **Redis Broker** | `6379` | Memory / Disk snapshot | Cache, Pub/Sub, Presence keys |
| **MongoDB Atlas**| `27017`| Cloud Atlas (Replica Set) | Persistent document source of truth |

---

## ⚡ Current Progress Summary

- **Phase 1 (FastAPI Foundation)**: ✅ **Completed & Verified**
- **Phase 2 (MongoDB Atlas Foundation)**: ✅ **Completed & Verified**
  - Connected to: `mongodb+srv://parhijyotiswarup_db_user:***@chat.njrcbvy.mongodb.net/?appName=Chat`
  - Health check: `{"status": "ok", "database": "connected"}`
- **Phase 3 (Authentication Service)**: ⏳ **Next in Queue**
