# 📚 FluxChat: Comprehensive File & Architectural Master Summary

> **Document Purpose**: This master document provides a comprehensive inventory of all files across the FluxChat repository, detailing **what each file does**, **why it was created**, **its architectural role**, and **how all components interconnect** across the Next.js 16 frontend and the 7 FastAPI microservices powered by MongoDB Atlas and WebSockets.

---

## 🏛️ 1. High-Level Architecture Overview

FluxChat is built on an enterprise-grade, distributed microservices architecture:

```text
                                 ┌─────────────────────────────────┐
                                 │     Next.js 16 Web Client       │
                                 │    (React 19, Tailwind CSS)     │
                                 └────────────────┬────────────────┘
                                                  │
                                          HTTPS & WSS (Port 8000)
                                                  │
                                                  ▼
                                 ┌─────────────────────────────────┐
                                 │       API Gateway Service       │
                                 │  (Port 8000: Proxy, Rate Limit) │
                                 └────────────────┬────────────────┘
                                                  │
         ┌───────────────┬────────────────┬───────┴────────┬───────────────┬───────────────┐
         │               │                │                │               │               │
         ▼               ▼                ▼                ▼               ▼               ▼
  ┌──────────────┐┌──────────────┐ ┌──────────────┐ ┌──────────────┐┌──────────────┐┌──────────────┐
  │ Auth Service ││ User Service │ │ Chat Service │ │ Message Svc  ││ WebSocket Svc││ Notification │
  │ (Port 8001)  ││ (Port 8002)  │ │ (Port 8003)  │ │ (Port 8004)  ││ (Port 8005)  ││ (Port 8006)  │
  └──────┬───────┘└──────┬───────┘ └──────┬───────┘ └──────┬───────┘└──────┬───────┘└──────┬───────┘
         │               │                │                │               │               │
         └───────────────┴────────────────┴───────┬────────┴───────────────┴───────────────┘
                                                  │
                                                  ▼
                                 ┌─────────────────────────────────┐
                                 │     Shared MongoDB Atlas DB     │
                                 │       (Database: fluxchat_db)   │
                                 └─────────────────────────────────┘
```

### Core Architecture Invariants:
1. **Layer Separation**: `Router (FastAPI)` ➡️ `Service (Business Logic)` ➡️ `Repository (Data Access)` ➡️ `MongoDB Atlas Collection`.
2. **Unified Ingress**: All frontend REST and WebSocket calls route through **API Gateway** (`:8000`), which manages CORS, rate limiting, and request tracing (`X-Request-ID`).
3. **Real Live Data Everywhere**: No mock data or fake success handlers. All actions update and read from live MongoDB Atlas collections.
4. **12-Factor Environment Compliance**: Secrets and URIs are never hardcoded. All services dynamically load credentials from `.env` files with safe local fallbacks.

---

## 🗄️ 2. MongoDB Atlas Collections & Data Models

| Collection | Model / Schema | Description | Key Fields |
|---|---|---|---|
| `users` | `UserModel` | User identity, credentials, and profile | `_id`, `name`, `username`, `email`, `password_hash`, `phone`, `avatar`, `bio`, `is_active`, `is_online`, `last_seen`, `created_at`, `updated_at` |
| `contacts` | `ContactModel` | Bilateral contact requests & rosters | `_id`, `requester_id`, `addressee_id`, `status` (`pending`, `accepted`, `rejected`, `cancelled`), `created_at`, `updated_at` |
| `conversations` | `ConversationModel` | Direct chats (1:1) and group channels | `_id`, `type` (`direct`, `group`), `participants`, `name`, `avatar`, `last_message`, `is_archived`, `created_at`, `updated_at` |
| `messages` | `MessageModel` | Chat messages, receipts & attachments | `_id`, `conversation_id`, `sender_id`, `content`, `type`, `status` (`sent`, `delivered`, `read`), `read_by`, `attachments`, `reply_to_id`, `is_deleted` |
| `notifications`| `NotificationModel` | User alert inbox | `_id`, `user_id`, `type` (`message`, `request`, `system`), `title`, `body`, `data`, `is_read`, `created_at` |
| `status_stories`| `StatusStoryModel` | 24-hour self-destructing photo & text stories | `_id`, `user_id`, `slides`, `expires_at`, `created_at` |
| `revoked_tokens`| `RevocationModel` | Blacklisted JWT refresh and access tokens | `_id`, `token`, `expires_at`, `revoked_at` |

---

## 📂 3. Exhaustive File-by-File Inventory & Purpose

---

### A. Root & Configuration Files

| File Path | Why It Was Created & What It Does |
|---|---|
| `FEATURES_AND_SYSTEM_DOCUMENTATION.md` | Master technical feature manual detailing Cloudinary media control, 24h status stories, group admin policies, Redis caching, and deployment parameters. |
| `RUNNING.md` | Master operational guide providing single-command startup (`./backend/start_all_backend.sh start`), prerequisites, port matrices, troubleshooting, and testing instructions. |
| `README.md` | Primary project repository overview detailing features, tech stack, screenshots, and getting started shortcuts. |
| `PROJECT_FILES_AND_ARCHITECTURE_SUMMARY.md` | *(This file)* Complete architectural blueprint and file-by-file catalog of the entire repository. |
| `.gitignore` | Prevents sensitive `.env` files, build artifacts (`.next/`, `dist/`), virtual environments (`venv/`), and logs from being committed to Git. |
| `docker-compose.yml` | Multi-container orchestration specification to launch all 7 microservices, API Gateway, and Redis locally in containerized environments. |
| `render.yaml` | Infrastructure as Code (IaC) blueprint for deploying the backend cluster and services onto the Render cloud platform. |
| `vercel.json` | Deployment and rewrite routing configuration for hosting the Next.js 16 frontend on Vercel. |
| `.env.example` | Root template showcasing required environment variables across both frontend and backend. |
| `.env.docker.example` | Configuration template specifically tuned for Docker container networking (`mongodb://mongo:27017`, `redis://redis:6379`). |

---

### B. Core Documentation & Guides (Root)

| File Path | Why It Was Created & What It Does |
|---|---|
| `README.md` | Master project introduction, features overview, quickstart instructions, and architecture breakdown. |
| `RUNNING.md` | Complete local and production operations manual, port matrix, environment configuration, troubleshooting, and commands. |
| `DEPLOYMENT.md` | Step-by-step production deployment guide for deploying Next.js frontend to Vercel and backend cluster to Render. |
| `FEATURES_AND_SYSTEM_DOCUMENTATION.md` | Master technical specification covering all enterprise features, Cloudinary media, 24h stories, purge mechanism, group policy, Redis caching, and full API endpoint catalog. |
| `PROJECT_FILES_AND_ARCHITECTURE_SUMMARY.md` | Exhaustive component-by-component file index, port mappings, data schemas, and event flows across the repository. |

---

### C. Backend API Gateway (`backend/services/api-gateway/`)
*Ingress point for all incoming traffic on Port 8000.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | FastAPI gateway application setup, CORS middleware, global sliding-window rate limiting, and unified Swagger documentation aggregator. |
| `app/core/config.py` | Gateway configuration loaded via Pydantic Settings, defining downstream microservice routing URLs and rate limit quotas. |
| `app/core/logging.py` | Structured JSON log formatter with correlation ID (`X-Request-ID`) propagation. |
| `app/core/rate_limiter.py` | High-performance sliding-window in-memory rate limiter with RFC quota headers. |
| `app/api/v1/router.py` | Central routing table mapping `/api/v1/auth`, `/api/v1/users`, `/api/v1/conversations`, `/api/v1/messages`, and `/api/v1/notifications` to downstream services. |
| `app/api/v1/health.py` | Composite cluster health probe that checks health and latency across all 6 downstream microservices simultaneously. |
| `app/api/v1/docs.py` | Proxies individual microservice `/openapi.json` schemas into a single unified Swagger UI dropdown. |
| `app/services/http_proxy.py` | Asynchronous reverse-proxy client built on `httpx.AsyncClient` with connection pooling and header forwarding. |
| `app/services/ws_proxy.py` | WebSocket tunnel forwarding real-time socket connections on `/ws` to the WebSocket Service (`:8005`). |

---

### D. Backend Authentication Service (`backend/services/auth-service/`)
*User credentials, registration, JWT lifecycle, and 2Factor SMS on Port 8001.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | Auth Service entry point, MongoDB connection lifecycle management, and route mounting. |
| `app/core/config.py` | Auth service settings (JWT secret, expiration limits, 2Factor SMS API keys, and MongoDB Atlas URI). |
| `app/core/jwt.py` | Cryptographic JWT token engine for generating and decoding HS256 access tokens and refresh tokens. |
| `app/core/security.py` | 12-round salted Bcrypt password hasher and constant-time password verifier. |
| `app/schemas/auth.py` | Pydantic request/response schemas for Registration, Login, Token Refresh, OTP Verification, and **Change Password**. |
| `app/models/user.py` | MongoDB user document factory and sanitization logic (removes `password_hash` from client responses). |
| `app/repositories/auth_repository.py` | Data access layer for `users` and `revoked_tokens` collections (CRUD, unique lookups, token revocation, password updates). |
| `app/services/auth_service.py` | Business logic for user registration, password authentication, token rotation, logout revocation, and **bcrypt password changes**. |
| `app/services/two_factor_service.py` | Integration with 2Factor.in SMS and voice call gateway for Indian telephone number verification. |
| `app/api/v1/auth.py` | HTTP route endpoints: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /send-otp`, `POST /verify-otp`, and **`POST /change-password`**. |
| `app/api/v1/router.py` | Mounts authentication routes and health check probes. |
| `tests/test_auth.py` | Automated test suite verifying registration, login, bad password rejections, token refresh, and logout revocation. |
| `tests/test_2factor.py` | Test suite covering OTP normalization, generation, and session validation. |
| `tests/test_health.py` | Verifies `/health` probes and Atlas database connectivity. |

---

### E. Backend User & Contacts Service (`backend/services/user-service/`)
*User profiles, search directory, and bilateral contact requests on Port 8002.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | User service application entry point and lifespan connection management. |
| `app/core/config.py` | Runtime settings loaded dynamically from `.env` (MongoDB URL, JWT secret). |
| `app/schemas/user.py` | Pydantic schemas for `UserProfileResponse`, `UserProfileUpdate` (name, username, email, phone, bio), and `UserSearchResponse`. |
| `app/schemas/contact.py` | Schemas for contact requests, accept/reject actions, and friendship rosters. |
| `app/repositories/user_repository.py` | MongoDB Atlas queries on `users` collection: ID/username/email/phone lookups, directory search regex, and profile updating. |
| `app/repositories/contact_repository.py` | MongoDB Atlas queries on `contacts` collection: bilateral friendship queries, pending requests, and status transitions. |
| `app/services/user_service.py` | Business logic for profile retrieval, **live uniqueness validation on profile updates**, and directory search. |
| `app/services/contact_service.py` | Business logic for sending contact requests, accepting/rejecting, and querying reciprocal rosters. |
| `app/api/v1/users.py` | Endpoints: `GET /users/me`, `PATCH /users/me` (live profile updates), `GET /users/search`, `GET /users/{user_id}`. |
| `app/api/v1/contacts.py` | Endpoints: `GET /contacts` (roster), `POST /contacts/request`, `POST /contacts/accept`, `POST /contacts/reject`. |
| `tests/test_users.py` | Tests profile retrieval, unauthorized rejections, and profile updates. |
| `tests/test_contacts.py` | Tests complete bilateral contact handshake lifecycle (request -> accept -> roster verification). |

---

### F. Backend Conversation Service (`backend/services/chat-service/`)
*1:1 direct chats and group channels on Port 8003.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | FastAPI application initialization and database connection lifecycle. |
| `app/core/config.py` | Configuration settings loaded from `.env`. |
| `app/schemas/conversation.py` | Schemas for direct/group conversation creation, participant management, and metadata updates. |
| `app/repositories/conversation_repository.py` | MongoDB Atlas queries on `conversations` collection: direct chat deduplication, user conversations list, and archive queries. |
| `app/services/conversation_service.py` | Business logic for creating 1:1 direct chats, creating group channels, adding/removing members, and updating last message metadata. |
| `app/api/v1/conversations.py` | Endpoints: `GET /conversations`, `POST /conversations/direct`, `POST /conversations/group`, `GET /conversations/{id}`. |
| `tests/test_conversations.py` | Tests conversation creation, direct chat deduplication, and participant listing. |

---

### G. Backend Message Service (`backend/services/message-service/`)
*Message dispatch, cursor pagination, edit/delete, and read receipts on Port 8004.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | Message service entry point and lifespan manager. |
| `app/core/config.py` | Message service configuration and database connection parameters. |
| `app/schemas/message.py` | Schemas for `SendMessageRequest`, `MessageResponse`, `CursorPagination`, and `ReadReceipt`. |
| `app/repositories/message_repository.py` | MongoDB Atlas queries on `messages` collection: cursor-based pagination, soft deletes, read receipts, and reactions. |
| `app/services/message_service.py` | Business logic for dispatching messages, updating conversation last message, and notifying WebSocket service. |
| `app/api/v1/messages.py` | Endpoints: `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, `PATCH /messages/{id}`, `DELETE /messages/{id}`, `POST /messages/{id}/read`. |
| `tests/test_messages.py` | Tests message creation, retrieval, cursor pagination, and read receipts. |

---

### H. Backend WebSocket Service (`backend/services/websocket-service/`)
*Real-time socket connections, presence tracking, and event dispatch on Port 8005.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | WebSocket service initialization and presence tracking lifecycle. |
| `app/core/config.py` | WebSocket service settings (Atlas URI, JWT secret, ports). |
| `app/services/connection_manager.py` | High-concurrency socket registry managing active user connections, room broadcasting, and disconnect cleanup. |
| `app/services/presence_service.py` | Tracks user online/offline/away states and broadcasts presence updates to contacts. |
| `app/api/v1/websockets.py` | WebSocket endpoint (`/ws`) handling connection handshake, authentication token validation, ping/pong, and typing indicators. |
| `tests/test_websocket.py` | Tests WebSocket authentication, connection acknowledgments, ping/pong, and presence broadcasting. |

---

### I. Backend Notification Service (`backend/services/notification-service/`)
*Alert inbox and unread notifications on Port 8006.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `app/main.py` | Notification service initialization and database connectivity. |
| `app/core/config.py` | Configuration settings loaded from `.env`. |
| `app/schemas/notification.py` | Request/response schemas for notification listings, unread counters, and mark-as-read actions. |
| `app/repositories/notification_repository.py` | MongoDB Atlas queries on `notifications` collection: user alert inbox, category filters, and bulk status updates. |
| `app/services/notification_service.py` | Business logic for creating system/message notifications, querying user alerts, and managing read states. |
| `app/api/v1/notifications.py` | Endpoints: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`. |
| `tests/test_notifications.py` | Tests notification creation, listing, category filtering, and read status updates. |

---

### J. Backend Shared Libraries (`backend/shared/`)
*Common dependencies, error contracts, database pooling, and security utilities.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `database/mongodb.py` | Enterprise singleton connection manager using `motor.motor_asyncio` with pooled connections and TLS verification. |
| `database/indexes.py` | Automatic index creation engine ensuring fast queries and uniqueness constraints on MongoDB Atlas collections. |
| `security/dependencies.py` | Reusable FastAPI dependency (`get_current_user`) for verifying HS256 Bearer JWT tokens across all microservices. |
| `security/rate_limit.py` | Sliding-window rate limiting dependency for protecting sensitive endpoints (login, register, send-otp). |
| `errors/exceptions.py` | Custom domain exceptions (`EntityNotFoundError`, `AuthenticationError`, `ConflictError`). |
| `errors/handlers.py` | Central exception handlers transforming unhandled errors into standardized RFC 7807 JSON error responses. |
| `health/probes.py` | Reusable health probe factory providing `/health`, `/health/live`, and `/health/ready` routes for cloud platforms, Render, and container environments. |
| `config/validator.py` | 12-factor configuration auditor verifying database URIs, JWT entropy, and environment flags. |
| `shared/requirements.txt` | Core shared dependencies (`motor`, `fastapi`, `pydantic-settings`, `pyjwt`, `bcrypt`, `certifi`). |

---

### K. Backend Harness & Scripts (`backend/`)

| File Path | Why It Was Created & What It Does |
|---|---|
| `start_all_backend.sh` | Master process manager supporting `start`, `stop`, `restart`, and `status` across all 7 microservices. |
| `run_all_tests.sh` | Master test runner executing all 9 microservice test suites and outputting comprehensive status reports. |
| `verify_env.py` | Diagnostic tool scanning and auditing all 10 environment configuration files for 12-factor compliance. |
| `run_api_gateway.sh` | Runner script launching API Gateway on Port `8000` with code reload. |
| `run_auth_service.sh` | Runner script launching Auth Service on Port `8001` with code reload. |
| `run_user_service.sh` | Runner script launching User Service on Port `8002` with code reload. |
| `run_chat_service.sh` | Runner script launching Chat Service on Port `8003` with code reload. |
| `run_message_service.sh` | Runner script launching Message Service on Port `8004` with code reload. |
| `run_websocket_service.sh` | Runner script launching WebSocket Service on Port `8005` with code reload. |
| `run_notification_service.sh` | Runner script launching Notification Service on Port `8006` with code reload. |
| `tests/e2e/test_full_journey.py` | End-to-end integration test traversing Gateway, Auth, Contacts, Chat, Messages, and WebSocket tunnel. |

---

### L. Frontend Web Application (`frontend/app/`)
*Next.js 16 (App Router) client application.*

| File Path | Why It Was Created & What It Does |
|---|---|
| `layout.tsx` | Root HTML layout providing theme provider, font configuration (Inter), and metadata. |
| `globals.css` | Global CSS styling, dark/light theme variables, and Tailwind base layers. |
| `page.tsx` | High-converting landing page with hero preview, feature strips, and direct login/register links. |
| `(auth)/login/page.tsx` | User login screen supporting email/username login and 2Factor mobile OTP login with error handling. |
| `(auth)/register/page.tsx` | Registration screen with Indian phone format (`+91`), password confirmation matching, and instant JWT storage. |
| `(auth)/forgot-password/page.tsx` | Password recovery page for mobile OTP verification and password reset. |
| `app/layout.tsx` | Authenticated shell layout hosting the `AppSidebar`, mobile navigation bar, and `WebSocketManager`. |
| `app/chats/page.tsx` | Chats hub displaying active conversations list, unread indicators, and empty state selector. |
| `app/chats/[conversationId]/page.tsx` | Active 1:1 and group chat room: message timeline, real-time socket events, composer, and attachment cards. |
| `app/contacts/page.tsx` | Contacts roster, live user directory search across the platform, and friend request actions. |
| `app/requests/page.tsx` | Received and sent contact requests manager with Accept / Reject buttons. |
| `app/groups/page.tsx` | Squad and community channels explorer, group creation modal, and active member roster. |
| `app/status/page.tsx` | 24-hour disappearing stories creator and fullscreen Instagram/WhatsApp-style story viewer. |
| `app/notifications/page.tsx` | Persistent notification center with category filters (Messages, Requests, System) and mark-as-read actions. |
| `app/profile/page.tsx` | User public profile view with nature gradient cover banner, stats bar, and edit profile modal. |
| `app/settings/account/page.tsx` | **Live Account Settings**: Displays live MongoDB profile data, handles real profile updates (name, username, email, phone, bio) with uniqueness checks, and provides real bcrypt-verified password change form. |
| `app/settings/appearance/page.tsx` | Theme customizer: Light / Dark / System mode, 14 curated color presets, native color wheel, and message density selector. |
| `app/settings/privacy/page.tsx` | Privacy preferences: Direct messaging permissions, online status visibility, read receipts, and typing indicators. |
| `app/settings/notifications/page.tsx` | Notification preferences: Push, desktop alerts, sound effects, and preview toggles. |

---

### M. Frontend Components (`frontend/components/`)

| File Path | Why It Was Created & What It Does |
|---|---|
| `ui/Button.tsx` | Accessible button component with primary, secondary, danger, and soft visual variants and loading spinners. |
| `ui/Input.tsx` | Form input component with labels, placeholder styling, error states, and dark mode support. |
| `ui/Card.tsx` | Visual card container with border styling, glassmorphic shadows, and dark mode tokens. |
| `ui/Avatar.tsx` | User avatar component displaying profile image or computed two-letter initials with online presence indicator. |
| `ui/Badge.tsx` | Status pill component supporting success, warning, danger, info, and outline variants. |
| `ui/Modal.tsx` | Accessible modal dialog with backdrop blur, keyboard `Escape` closing, and focus trap. |
| `ui/PhoneInput.tsx` | International telephone input with country dial code selector (default `+91 🇮🇳`). |
| `ui/Switch.tsx` | Toggle switch component for binary settings (e.g. read receipts, dark mode). |
| `ui/Tabs.tsx` | Multi-tab switcher component for navigating between categorized views. |
| `ui/ThemeToggle.tsx` | Quick action button toggling between Light, Dark, and System theme modes. |
| `chat/ConversationList.tsx` | Sidebar conversation list supporting primary/general tabs, search filtering, and unread badges. |
| `chat/ConversationItem.tsx` | Individual conversation row displaying contact avatar, last message preview, timestamp, and unread counter. |
| `chat/ChatHeader.tsx` | Conversation room header showing contact status, online presence indicator, and call/search action buttons. |
| `chat/MessageBubble.tsx` | Message bubble component displaying message text, attachments, read receipts (`CheckCheck`), and timestamp. |
| `chat/MessageInput.tsx` | Message composer input supporting keyboard `Enter` send, emoji picker trigger, and file attachments. |
| `chat/AttachmentCard.tsx` | Visual attachment card supporting image previews, document downloads, and voice notes. |
| `layout/AppSidebar.tsx` | Main navigation sidebar hosting icons for Chats, Contacts, Requests, Groups, Status, Notifications, and Settings. |
| `layout/AppMobileNav.tsx` | Responsive bottom navigation bar for mobile viewports. |
| `layout/WebSocketManager.tsx` | Background component maintaining persistent WebSocket connection to `:8005` with auto-reconnect. |
| `theme/ThemeProvider.tsx` | React context provider injecting dynamic CSS theme variables (`--primary`, `--bubble-sent`) into the DOM. |

---

### N. Frontend Libraries, Utilities & APIs (`frontend/lib/`)

| File Path | Why It Was Created & What It Does |
|---|---|
| `lib/api/auth.ts` | REST client for Auth Service (`/auth/login`, `/auth/register`, `/auth/send-otp`, `/auth/change-password`, `/auth/logout`). |
| `lib/api/user.ts` | REST client for User Service (`/users/me`, `/users/search`, `/users/{id}`). |
| `lib/api/contact.ts` | REST client for Contacts System (`/contacts`, `/contacts/request`, `/contacts/accept`, `/contacts/reject`). |
| `lib/api/chat.ts` | REST client for Chat Service (`/conversations`, `/conversations/direct`, `/conversations/group`). |
| `lib/api/message.ts` | REST client for Message Service (`/conversations/{id}/messages`, `/messages/{id}/read`). |
| `lib/api/websocket.ts` | WebSocket client helper managing connection handshake, event dispatching, and ping/pong. |
| `lib/api/notification.ts` | REST client for Notification Service (`/notifications`, `/notifications/{id}/read`). |
| `lib/utils/cn.ts` | Utility helper merging Tailwind CSS class names via `clsx` and `tailwind-merge`. |
| `lib/utils/themeColors.ts` | Color math utility generating 14 curated accent palettes and dynamic HSL color values. |
| `hooks/useTheme.ts` | React hook exposing current theme mode (`light`/`dark`), active accent color, and setter functions. |
| `types/*.ts` | TypeScript definitions for `User`, `Conversation`, `Message`, `Contact`, `Notification`, and `Status`. |

---

### O. Cloud & Production Deployment (`render.yaml`, Docker & Vercel)

| File Path | Why It Was Created & What It Does |
|---|---|
| `render.yaml` | Infrastructure as Code blueprint for Render.com deploying the full backend cluster and managed Redis instance with environment variables, health checks, and autoscaling. |
| `backend/Dockerfile.render` | Production multi-stage Docker build packaging Python 3.12, system dependencies, all 7 microservices, and supervisor orchestration. |
| `backend/scripts/start_render.sh` | Production entrypoint script verifying Redis/MongoDB connectivity, launching background microservices, and running the public API Gateway on port 8000. |
| `frontend/vercel.json` | Edge routing, security headers (CSP, HSTS), and static caching policy for Next.js frontend deployment on Vercel. |
| `docker-compose.yml` | Full-stack local development orchestration powering all 7 microservices, Redis, MongoDB Atlas, and Next.js frontend concurrently. |

---

## 🔍 4. Key Workflows & Data Flows

### 1. User Authentication & Session
1. User enters credentials on `/login`.
2. Frontend calls `POST /api/v1/auth/login` on API Gateway (`:8000`).
3. Gateway proxies request to Auth Service (`:8001`).
4. Auth Service fetches user record from MongoDB Atlas `users` collection, verifies password hash using 12-round **Bcrypt**.
5. Returns signed JWT Access Token and Refresh Token.
6. Frontend stores tokens in `localStorage` and establishes persistent WebSocket connection to `ws://localhost:8000/ws`.

### 2. Live Profile Update & Password Change
1. User navigates to `/app/settings/account`.
2. Page fetches live MongoDB Atlas user document via `GET /api/v1/users/me`.
3. User updates fields (e.g. Bio, Phone, Name) and clicks **Save Profile Changes**.
4. User Service validates uniqueness of username/email/phone against MongoDB Atlas and persists changes.
5. User enters Current Password and New Password and clicks **Update Password**.
6. Auth Service verifies current password via Bcrypt, validates minimum length (6 chars), hashes new password, and commits to MongoDB Atlas.

### 3. Real-Time Chat & Read Receipts
1. User sends message in active conversation.
2. Frontend submits `POST /api/v1/conversations/{id}/messages` to Message Service (`:8004`).
3. Message Service saves document into MongoDB Atlas `messages` collection and updates `last_message` on the conversation.
4. Message Service dispatches socket event to WebSocket Service (`:8005`).
5. WebSocket Service broadcasts `message.created` to recipient's active socket.
6. When recipient views message, frontend triggers `POST /api/v1/messages/{id}/read`, which updates `read_by` array and broadcasts `message.read` receipt back to sender.

---

## 🎯 5. Summary Table of Microservices

| Microservice | Port | Database Collection | Primary Responsibility |
|---|---|---|---|
| **API Gateway** | `8000` | — | Single unified ingress, reverse-proxy, rate-limiting, WS tunnel, health checks |
| **Auth Service** | `8001` | `users`, `revoked_tokens` | Registration, login, Bcrypt hashing, JWT rotation, 2Factor SMS, password change |
| **User Service** | `8002` | `users`, `contacts` | Profiles, directory search, bilateral friend requests, friendship rosters |
| **Chat Service** | `8003` | `conversations` | 1:1 direct chats, group channel creation, member management |
| **Message Service** | `8004` | `messages` | Message persistence, cursor pagination, edit/delete, read receipts |
| **WebSocket Service** | `8005` | `users` (presence) | Real-time bidirectional socket events, online/offline presence, typing status |
| **Notification Service** | `8006` | `notifications` | System alerts, message notifications, unread counters |
| **Frontend Web App** | `3000` | Client State (`localStorage`) | Next.js 16 UI, themes, chat rooms, settings, story viewer |
