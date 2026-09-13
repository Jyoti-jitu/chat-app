# FluxChat — Modern Real-Time Chat & Collaboration Platform

FluxChat is a full-featured, responsive, and beautifully designed modern messaging and collaboration platform built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and 7 distributed FastAPI microservices backed by MongoDB Atlas.

> 📖 **Core Documentation for Presentation & Evaluation:**
> - [PROJECT_IDEA_AND_HLD.md](PROJECT_IDEA_AND_HLD.md) — **Project Idea & High-Level Design (HLD)**: Problem statement, microservices decomposition, system architecture diagrams, and tradeoffs.
> - [PROJECT_LLD.md](PROJECT_LLD.md) — **Low-Level Design (LLD)**: Three-tier layering, MongoDB BSON schemas, API endpoint catalog, WebSocket protocols, and caching policies.
> - [backend/BACKEND_FILE_AND_FOLDER_USAGE.md](backend/BACKEND_FILE_AND_FOLDER_USAGE.md) — **Backend File & Folder Architecture Guide**: Exhaustive breakdown of all backend services, shared packages, runner scripts, and why each file is required.
> - [RUNNING.md](RUNNING.md) — Step-by-step startup guide, local execution, and health probes.
> - [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment guide for Vercel (Frontend) & Render (Backend).

---

## 🚀 Key Features

- 💬 **Real-Time Direct & Group Messaging**:
  - Sub-50ms message exchange via Redis Pub/Sub and WebSocket streaming.
  - Multi-tab conversation switcher with instant search, message timestamps, and delivery status indicators.
  - Safe message deletion (for self/everyone), clear chat history, and conversation purge.
  - Real-time active typing indicators and automatic text area focus.

- 👥 **Group & Squad Management**:
  - Discover, join, and manage private & public team squads and community channels.
  - Founding admin privileges, join approval workflows, active member rosters, and member role promotion/demotion.
  - Rich group creation flow with custom emoji avatars and member invite selector.

- ⭕ **24-Hour Ephemeral Status Stories**:
  - Share disappearing text and media stories with custom typography (Modern, Serif, Mono, Bold) and gradient backdrops.
  - Fullscreen Instagram/WhatsApp-style story viewer with multi-segment timer, quick emoji reactions, and reply input.
  - Slide-level and whole-story deletion controls.

- 📇 **Contacts & Friend Requests**:
  - Search registered users by phone number or username.
  - Send, accept, reject, or cancel contact requests with real-time UI updates and live toast notifications.
  - Direct message, voice, and video call actions with quick confirmation modals.

- 🔔 **Real-Time Notifications Subsystem**:
  - Real-time in-app toast banners and persistent notification inbox for contact requests, group join requests, and administrative approvals.
  - Filtered notifications (All, Messages, Requests, System) with mark-as-read, individual dismiss, and clear-all actions.

- 👤 **Customizable User Profile**:
  - Cloudinary CDN media uploads for profile avatars and banner covers.
  - Add unlimited custom web and social links (GitHub, LinkedIn, Twitter, Portfolio, etc.) with real-time editing.

- 🎨 **Dynamic Appearance & Custom Color Engine**:
  - Zero-FOUC persistent Dark / Light mode toggle.
  - 14 curated high-contrast accent presets across Greens, Blues, Purples, Warm & Minimal tones.
  - Native color wheel picker and custom Hex input with dynamic CSS variable recalculation.

- 🔐 **Dual Authentication & Security**:
  - Mobile password login and One-Time OTP login flows with country dial code selector.
  - Interactive 6-digit SMS verification with resend timer on registration.
  - Cryptographic JWT access/refresh tokens with in-memory Redis token revocation blacklist.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Backend Services (7 Microservices)**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+), [Uvicorn](https://www.uvicorn.org/)
  - `api-gateway` (:8000) — Reverse proxy, request aggregation, JWT validation, and CORS routing
  - `auth-service` (:8001) — Authentication, registration, OTP lifecycle, and token revocation
  - `user-service` (:8002) — User profiles, avatar/cover uploads, unlimited links, contacts, and friend requests
  - `chat-service` (:8003) — Conversation management, group policies, join requests, and member roles
  - `message-service` (:8004) — Message storage, attachments, pagination, and deletion
  - `websocket-service` (:8005) — Real-time bidirectional WebSocket connections & Redis subscription
  - `notification-service` (:8006) — Persistent notifications inbox and real-time alert dispatch
- **Database & Storage**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Motor Async Driver), [Cloudinary CDN](https://cloudinary.com/) (Media assets)
- **Message Bus & In-Memory Cache**: [Redis](https://redis.io/) (Pub/Sub message bus, active chat cache, token blacklist)

---

## 📁 Repository Structure

```text
chat-app/
├── PROJECT_IDEA_AND_HLD.md       # Master High-Level Design & System Architecture
├── PROJECT_LLD.md                # Master Low-Level Design, Schemas & API Contracts
├── RUNNING.md                    # Local Execution & Verification Guide
├── DEPLOYMENT.md                 # Production Cloud Deployment Guide (Vercel + Render)
├── docker-compose.yml            # Local multi-container Docker deployment
├── render.yaml                   # Infrastructure-as-code for Render cloud deployment
├── frontend/                     # Next.js 16 Web Application
│   ├── app/                      # App router pages (auth, chats, contacts, groups, status, profile)
│   ├── components/               # Modular UI, chat, modals, and layout components
│   ├── hooks/                    # Custom React hooks (theme, mobile, websocket)
│   ├── lib/                      # API clients, WebSocketManager, utilities
│   └── types/                    # Domain TypeScript interfaces
├── backend/                      # Distributed Microservices Architecture
│   ├── services/
│   │   ├── api-gateway/          # Reverse proxy (:8000)
│   │   ├── auth-service/         # Authentication & OTP (:8001)
│   │   ├── user-service/         # Profiles, links & contacts (:8002)
│   │   ├── chat-service/         # Conversations & groups (:8003)
│   │   ├── message-service/      # Messages & history (:8004)
│   │   ├── websocket-service/    # Real-time WebSockets (:8005)
│   │   └── notification-service/ # Notifications & alerts (:8006)
│   ├── shared/                   # Shared auth, database, models, and health probes
│   └── start_all_backend.sh      # Unified microservices orchestration script
└── README.md
```

---

## ⚡ Getting Started

> 📘 **For the comprehensive, step-by-step startup, environment configuration, and troubleshooting guide, please see [RUNNING.md](RUNNING.md).**

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Jyoti-jitu/chat-app.git
   cd chat-app
   ```

2. **Start all 7 backend microservices** (API Gateway, Auth, User, Chat, Message, WebSocket, Notification):
   ```bash
   ./backend/start_all_backend.sh start
   ```

3. **Start the Next.js Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application**:
   - **Frontend App**: [http://localhost:3000](http://localhost:3000)
   - **API Gateway Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Cluster Health Probes**: [http://localhost:8000/health](http://localhost:8000/health)

To stop backend services:
```bash
./backend/start_all_backend.sh stop
```

---

## 🧪 Linting & Building

```bash
# Run ESLint
npm run lint

# Build production bundle with Turbopack
npm run build
```

---

## 📄 License

This project is licensed under the MIT License.
