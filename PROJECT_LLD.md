# FluxChat — Low-Level Design (LLD) & Technical Specifications

---

## 1. Architectural Patterns & Layering

FluxChat adheres to a strict **Three-Tier Domain Layering** pattern across all backend microservices:

```
[ HTTP Ingress / API Gateway (:8000) ]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ 1. Controller / Router Layer (app/api/v1/*.py)         │
│    - HTTP Endpoint routing, URL parameters, query args │
│    - Payload validation via Pydantic schemas           │
│    - JWT token extraction & authentication guardrails  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Service / Domain Layer (app/services/*.py)          │
│    - Business rule enforcement and invariant checks    │
│    - Event publication to Redis Pub/Sub bus            │
│    - Inter-service client orchestration                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Repository / Data Layer (app/repositories/*.py)     │
│    - MongoDB Atlas Motor queries & projection filters  │
│    - BSON ObjectId serialization and sanitization      │
│    - Redis cache retrieval and invalidation            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema & Data Models (MongoDB Atlas)

FluxChat uses **MongoDB Atlas** for document persistence. Below are the canonical BSON schemas, data types, indexes, and relations.

### 2.1 `users` Collection
Stores registered user identities, authentication details, public profiles, and unlimited web/social links.

```json
{
  "_id": "ObjectId",
  "name": "String (2-100 chars)",
  "username": "String (3-30 chars, lowercase, indexed)",
  "email": "String (valid email, lowercase, indexed)",
  "password_hash": "String (Argon2 / Bcrypt salted hash)",
  "phone": "String (Optional, indexed)",
  "avatar": "String (Cloudinary HTTPS URL or data URI)",
  "cover_image": "String (Cloudinary HTTPS URL or data URI)",
  "bio": "String (Optional, max 250 chars)",
  "website": "String (Optional legacy single URL)",
  "links": [
    {
      "title": "String (e.g., 'GitHub', 'LinkedIn', 'Portfolio')",
      "url": "String (valid HTTPS URL)"
    }
  ],
  "is_active": "Boolean (default: true)",
  "is_online": "Boolean (default: false)",
  "last_seen": "ISODate",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
**MongoDB Indexes**:
- `{"username": 1}` — Unique index (sparse).
- `{"email": 1}` — Unique index.
- `{"phone": 1}` — Sparse index for contact discovery.

---

### 2.2 `conversations` Collection
Represents both direct 1:1 messaging channels and multi-member group conversations with administrative controls.

```json
{
  "_id": "ObjectId",
  "type": "String ('direct' | 'group')",
  "name": "String (Optional for direct, required for group)",
  "description": "String (Optional, group summary)",
  "avatar": "String (Cloudinary group avatar URL)",
  "created_by": "String (User ID of founding admin)",
  "members": ["String (User IDs of active participants)"],
  "admins": ["String (User IDs of participants with admin rights)"],
  "join_mode": "String ('open' | 'approval')",
  "join_requests": [
    {
      "user_id": "String",
      "name": "String",
      "username": "String",
      "avatar": "String",
      "requested_at": "ISODate"
    }
  ],
  "last_message": {
    "id": "String",
    "sender_id": "String",
    "content": "String",
    "created_at": "ISODate"
  },
  "cleared_by": ["String (User IDs who have purged their thread inbox)"],
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
**MongoDB Indexes**:
- `{"members": 1}` — Multi-key index to rapidly list user conversations.
- `{"type": 1, "members": 1}` — Query optimizer for bilateral direct chat lookup.

---

### 2.3 `messages` Collection
Stores historical chat messages, attachments, emoji reactions, and read receipts.

```json
{
  "_id": "ObjectId",
  "conversation_id": "String (Hex ObjectId or virtual 'c_' ID)",
  "sender_id": "String (User ID of author)",
  "content": "String (UTF-8 message body)",
  "attachments": [
    {
      "url": "String (Cloudinary CDN URL)",
      "name": "String (Original filename)",
      "size": "Number (File size in bytes)",
      "content_type": "String (MIME type, e.g., 'image/png')",
      "format": "String (File extension, e.g., 'png')"
    }
  ],
  "reactions": {
    "👍": ["user_id_1", "user_id_2"],
    "❤️": ["user_id_3"]
  },
  "read_by": ["String (User IDs who have seen the message)"],
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
**MongoDB Indexes**:
- `{"conversation_id": 1, "created_at": -1}` — Compound index for paginated message history queries.

---

### 2.4 `contacts` & `contact_requests` Collections
Manages friendships and the bilateral connection request lifecycle.

**`contacts` Document**:
```json
{
  "_id": "ObjectId",
  "user_id": "String",
  "contact_id": "String",
  "created_at": "ISODate"
}
```
*Index*: `{"user_id": 1, "contact_id": 1}` (Unique compound index).

**`contact_requests` Document**:
```json
{
  "_id": "ObjectId",
  "sender_id": "String",
  "recipient_id": "String",
  "status": "String ('pending' | 'accepted' | 'rejected' | 'cancelled')",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
*Index*: `{"recipient_id": 1, "status": 1}` and `{"sender_id": 1, "recipient_id": 1}`.

---

### 2.5 `notifications` Collection
Stores persistent notifications displayed in the notification center and triggered as live floating toasts.

```json
{
  "_id": "ObjectId",
  "user_id": "String (Target recipient user ID)",
  "actor_id": "String (User triggering the action)",
  "type": "String ('request' | 'message' | 'system')",
  "category": "String ('requests' | 'messages' | 'system')",
  "title": "String (e.g., 'New Connection Request')",
  "description": "String (Human-readable alert summary)",
  "reference_id": "String (Associated request or conversation ID)",
  "link": "String (App navigation URL, e.g., '/app/requests')",
  "is_read": "Boolean (default: false)",
  "created_at": "ISODate"
}
```
*Index*: `{"user_id": 1, "is_read": 1, "created_at": -1}`.

---

### 2.6 `status_stories` Collection
Stores 24-hour self-destructing status stories visible strictly to confirmed contacts.

```json
{
  "_id": "ObjectId",
  "user_id": "String (Author user ID)",
  "slides": [
    {
      "id": "String (UUID)",
      "media_url": "String (Cloudinary photo URL or empty for text)",
      "text_content": "String (Styled story text)",
      "background_gradient": "String (CSS linear gradient)",
      "font_family": "String (Selected Google Font)",
      "caption": "String (Photo caption)",
      "created_at": "ISODate"
    }
  ],
  "expires_at": "ISODate (Auto-calculated: created_at + 24 hours)",
  "created_at": "ISODate"
}
```
*Index*: `{"expires_at": 1}` (MongoDB native TTL index for automatic physical document expiration).

---

### 2.7 `revoked_tokens` Collection
Maintains an in-memory-speed revocation blacklist for invalidated JWTs.

```json
{
  "_id": "ObjectId",
  "token": "String (Raw JWT string)",
  "expires_at": "ISODate",
  "revoked_at": "ISODate"
}
```
*Index*: `{"token": 1}` (Unique) and `{"expires_at": 1}` (TTL index).

---

## 3. Comprehensive API Endpoint Catalog

All microservices run on designated local ports and are unified under the API Gateway on port `8000`.

### 3.1 API Gateway Routes (`http://127.0.0.1:8000`)

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Cluster aggregate health probe | No |
| `POST` | `/api/v1/media/upload` | Multipart file upload to Cloudinary CDN | Bearer JWT |
| `POST` | `/api/v1/media/upload-base64`| Base64 data URI upload to Cloudinary CDN | Bearer JWT |
| `*` | `/api/v1/auth/*` | Proxied to Auth Service (`:8001`) | Passthrough |
| `*` | `/api/v1/users/*` | Proxied to User Service (`:8002`) | Passthrough |
| `*` | `/api/v1/contacts/*`| Proxied to User Service (`:8002`) | Passthrough |
| `*` | `/api/v1/status/*` | Proxied to User Service (`:8002`) | Passthrough |
| `*` | `/api/v1/conversations/*` | Proxied to Chat Service (`:8003`) | Passthrough |
| `*` | `/api/v1/messages/*`| Proxied to Message Service (`:8004`) | Passthrough |
| `*` | `/api/v1/notifications/*` | Proxied to Notification Service (`:8006`) | Passthrough |

---

### 3.2 Auth Service Endpoints (`:8001`)

| Method | Path | Request Body | Response (200/201) |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `name`, `username`, `email`, `password`, `phone` | `access_token`, `refresh_token`, `user` |
| `POST` | `/api/v1/auth/login` | `email` or `username`, `password` | `access_token`, `refresh_token`, `user` |
| `POST` | `/api/v1/auth/refresh` | `refresh_token` | `access_token`, `refresh_token` |
| `POST` | `/api/v1/auth/logout` | `refresh_token` | `{"message": "Logged out successfully"}` |

---

### 3.3 User & Contact Service Endpoints (`:8002`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/users/me` | Fetch authenticated user's private profile and links |
| `PATCH`| `/api/v1/users/me` | Update display name, bio, avatar, cover, and `links: [{title, url}]` |
| `GET` | `/api/v1/users/search` | Search registered directory by username, name, or phone |
| `GET` | `/api/v1/users/{id}` | Retrieve public profile of another user |
| `GET` | `/api/v1/contacts` | List confirmed contacts roster |
| `POST` | `/api/v1/contacts/requests` | Send connection request (triggers persistent + WebSocket notification) |
| `GET` | `/api/v1/contacts/requests` | List sent and received pending connection requests |
| `POST` | `/api/v1/contacts/requests/{id}/accept` | Accept request (creates bilateral link and notifies requester) |
| `POST` | `/api/v1/contacts/requests/{id}/reject` | Decline pending connection request |
| `DELETE`| `/api/v1/contacts/{id}` | Remove user from confirmed contact roster |
| `GET` | `/api/v1/status` | List active 24h status stories from confirmed contacts |
| `POST` | `/api/v1/status` | Post a new photo or text story slide (24h TTL) |
| `DELETE`| `/api/v1/status/{slide_id}` | Delete an individual story slide |

---

### 3.4 Chat Service Endpoints (`:8003`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/conversations` | List user's active conversations |
| `POST` | `/api/v1/conversations/direct/{user_id}` | Get or create 1:1 conversation |
| `POST` | `/api/v1/conversations/group` | Create group with name, avatar, members, and `join_mode` |
| `POST` | `/api/v1/conversations/{id}/join` | Join open group or submit join request for admin approval |
| `GET` | `/api/v1/conversations/{id}/join-requests` | View pending join requests (Admin only) |
| `POST` | `/api/v1/conversations/{id}/join-requests/{uid}/approve` | Approve join request and notify user (Admin only) |
| `POST` | `/api/v1/conversations/{id}/join-requests/{uid}/reject` | Decline join request (Admin only) |
| `PATCH`| `/api/v1/conversations/{id}/settings` | Update group name, avatar, description, or `join_mode` |
| `POST` | `/api/v1/conversations/{id}/admins/{uid}` | Promote member to group admin (Admin only) |
| `DELETE`| `/api/v1/conversations/{id}/members/{uid}` | Remove member from group (Admin only) |
| `DELETE`| `/api/v1/conversations/{id}` | Permanently delete conversation and purge messages |

---

### 3.5 Message Service Endpoints (`:8004`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/messages/{conversation_id}` | Retrieve messages (queries Redis cache first; falls back to MongoDB) |
| `POST` | `/api/v1/messages` | Send message with text/attachments (updates DB, cache, and Redis Pub/Sub) |
| `POST` | `/api/v1/messages/{id}/reactions` | Toggle emoji reaction on a message |
| `POST` | `/api/v1/messages/read` | Mark all unread messages in a conversation as read |

---

### 3.6 Notification Service Endpoints (`:8006`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/notifications` | List user notifications with category filters (`all`, `requests`, `messages`) |
| `POST` | `/api/v1/notifications` | Internal endpoint: persist alert and publish `notification.new` to Redis |
| `POST` | `/api/v1/notifications/{id}/read` | Mark individual notification as read |
| `POST` | `/api/v1/notifications/read-all` | Mark all user notifications as read |
| `DELETE`| `/api/v1/notifications/{id}` | Dismiss/delete an individual notification |

---

## 4. WebSocket Protocols & Real-Time Specifications

### 4.1 Connection Handshake
- **URL**: `ws://127.0.0.1:8005/ws?token=<JWT_ACCESS_TOKEN>`
- **Handshake Protocol**:
  1. WebSocket Service validates JWT from query parameter.
  2. Extracts authenticated `user_id`.
  3. Registers connection in `ConnectionManager` pool under `active_connections[user_id]`.
  4. Publishes online status to Redis.

### 4.2 Outbound Server Event Frames (`fluxchat:events`)

#### Event: `chat.message_sent`
Broadcast when a new message is saved:
```json
{
  "event": "chat.message_sent",
  "data": {
    "id": "msg_6aa5bf...",
    "conversation_id": "conv_123...",
    "sender_id": "usr_456...",
    "content": "Hello world!",
    "attachments": [],
    "reactions": {},
    "created_at": "2026-09-14T01:30:00Z"
  },
  "recipients": ["usr_789..."]
}
```

#### Event: `notification.new`
Broadcast when a new connection request, approval, or alert occurs:
```json
{
  "event": "notification.new",
  "data": {
    "id": "notif_6aa700...",
    "type": "request",
    "category": "requests",
    "title": "New Connection Request",
    "description": "Rajesh (@rajesh) sent you a connection request.",
    "actor": {
      "name": "Rajesh",
      "username": "rajesh",
      "avatar": "https://res.cloudinary.com/..."
    },
    "link": "/app/requests",
    "is_read": false,
    "created_at": "2026-09-14T01:30:00Z"
  },
  "recipients": ["usr_789..."]
}
```

#### Event: `typing.started` & `typing.stopped`
Ephemeral typing indicators sent to participants:
```json
{
  "event": "typing.started",
  "data": {
    "conversation_id": "conv_123...",
    "user_id": "usr_456...",
    "name": "Rajesh"
  },
  "recipients": ["usr_789..."]
}
```

---

## 5. Caching Strategy & Redis Key Schemas

```
+---------------------------------------------------------------------------------------+
|                                    REDIS KEY ARCHITECTURE                             |
+------------------------------------+------------+-------+-----------------------------+
| Key Pattern                        | Type       | TTL   | Purpose                     |
+------------------------------------+------------+-------+-----------------------------+
| cache:messages:{convId}:{limit}    | StringJSON | 300s  | Cached message thread array |
| user:online:{userId}               | String     | 60s   | Presence heartbeat probe    |
| fluxchat:events                    | Channel    | N/A   | Real-time Pub/Sub bus       |
| system:broadcast                   | Channel    | N/A   | Cluster-wide maintenance    |
+------------------------------------+------------+-------+-----------------------------+
```

### 5.1 Invalidation Policy
- **On New Message**: Message Service prepends the new message to `cache:messages:{convId}:{limit}` or invalidates the key so the next read hydrates cleanly from MongoDB Atlas.
- **On Chat Purge**: Chat Service and Message Service delete all keys matching `cache:messages:{convId}:*`.

---

## 6. Frontend Architecture & Client-Side Design

### 6.1 Directory & Layout Hierarchy
```
frontend/
├── app/
│   ├── app/
│   │   ├── layout.tsx         # Mounts AppSidebar, AppMobileNav & WebSocketManager
│   │   ├── chats/page.tsx     # Chat listing and active thread view
│   │   ├── contacts/page.tsx  # Confirmed contacts roster & directory search
│   │   ├── requests/page.tsx  # Connection requests inbox (Received & Sent)
│   │   ├── notifications/page # Notification center with filter tabs
│   │   ├── status/page.tsx    # 24h photo & text stories viewer/creator
│   │   ├── groups/page.tsx    # Group discovery and admin dashboards
│   │   └── profile/page.tsx   # Profile editor with unlimited links builder
├── components/
│   ├── chat/                  # MessageBubble, MessageInput, AttachmentCard
│   ├── layout/                # AppSidebar, AppMobileNav, WebSocketManager
│   └── ui/                    # Avatar, Button, Modal, Input, Tabs
├── lib/
│   ├── api/                   # REST API clients (auth, chat, user, contact, etc.)
│   └── utils/                 # cn (classnames helper)
```

### 6.2 Global `WebSocketManager` Component
Mounted at `app/app/layout.tsx`:
- Connects to the WebSocket service on token availability and auto-reconnects on window focus.
- Listens for `notification.new` frames and renders a floating glassmorphic in-app toast stack in the top-right corner.
- Provides a direct **"View Request"** button routing to `/app/requests` with a 6-second auto-dismiss.
- Dispatches custom browser events (`fluxchat:notification_received`, `fluxchat:requests_updated`, `fluxchat:profile_updated`) so open pages and sidebar badges update instantly without page reloads.

---

## 7. Error Handling Matrix

All microservices adhere to standard RFC-7807 error envelopes:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "details": null,
    "request_id": "req_8b4c02f1a8de"
  }
}
```

```
+--------------------+---------------------------+--------------------------------------+
| HTTP Status Code   | Exception Class           | Typical Scenario                     |
+--------------------+---------------------------+--------------------------------------+
| 400 Bad Request    | ValidationError           | Missing required field or invalid id |
| 401 Unauthorized   | AuthenticationError       | Missing, expired, or revoked JWT     |
| 403 Forbidden      | AuthorizationError        | Non-admin attempting admin action    |
| 404 Not Found      | NotFoundError             | User, message, or chat not in DB     |
| 409 Conflict       | ConflictError             | Username, email, or request exists   |
| 429 Too Many Req   | RateLimitError            | Rate limit quota exceeded            |
| 502 Bad Gateway    | BadGatewayError           | Inter-service network communication  |
| 503 Service Unavail| ServiceUnavailableError   | Dependent service down for boot      |
+--------------------+---------------------------+--------------------------------------+
```

---

## 8. Summary
This Low-Level Design (LLD) details the implementation structure of FluxChat. Its separation of concerns, structured BSON schemas, normalized REST endpoints, and unified WebSocket event frames ensure high maintainability, observability, and performance across the entire application stack.
