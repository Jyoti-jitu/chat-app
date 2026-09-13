# FluxChat — Modern Real-Time Chat & Collaboration Platform

FluxChat is a full-featured, responsive, and beautifully designed modern messaging and collaboration platform built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and 7 distributed FastAPI microservices backed by MongoDB Atlas.

> 📖 **Quick Links:**
> - [RUNNING.md](RUNNING.md) — Step-by-step startup guide, local execution, and troubleshooting.
> - [DEPLOYMENT.md](DEPLOYMENT.md) — 10-minute production deployment guide for Vercel (Frontend) & Render (Backend).
> - [FEATURES_AND_SYSTEM_DOCUMENTATION.md](FEATURES_AND_SYSTEM_DOCUMENTATION.md) — Enterprise features, Cloudinary media, 24h stories, data purge, group management, and complete API catalog.
> - [PROJECT_FILES_AND_ARCHITECTURE_SUMMARY.md](PROJECT_FILES_AND_ARCHITECTURE_SUMMARY.md) — Exhaustive master inventory of all files, models, and architectural components.

---

## 🚀 Key Features

- 💬 **Real-Time Direct & Group Messaging**:
  - Full-featured chat interface with timestamps, status receipts (sent, delivered, read), and attachment sharing.
  - Multi-tab conversation switcher with real-time search.
  - Safe message deletion (for self/everyone), clear chat history, and delete conversation options.

- 👥 **Groups & Communities**:
  - Discover, join, and manage private & public team squads and community channels.
  - Interactive group info modal, active member rosters, mute notifications, and admin group deletion.
  - Rich group creation flow with custom emoji avatars and member picker.

- ⭕ **24-Hour Status & Stories**:
  - Share disappearing text and gradient stories with rich typography (Modern, Serif, Mono, Bold).
  - Fullscreen Instagram/WhatsApp-style story viewer with multi-segment timer, quick emoji reactions, and reply input.
  - Slide-level and whole-story deletion controls.

- 📇 **Contacts Management**:
  - Categorized online and offline contacts with search and quick actions (Direct Message, Voice Call, Video Call).
  - Add new contact modal and delete contact action with safe confirmation modals.

- 🔔 **Notifications Center**:
  - Filtered notifications (All, Messages, Requests, System) with mark-as-read, individual dismiss/delete, and clear-all actions.

- 🎨 **Dynamic Appearance & Custom Color Engine**:
  - Dark / Light mode toggle with zero-FOUC persistent theme engine.
  - 14 curated high-contrast accent presets across Greens, Blues, Purples, Warm & Minimal tones.
  - Native color wheel picker and custom Hex input with real-time CSS variable recalculation.

- 🔐 **Phone Authentication & OTP**:
  - Default India (`+91 🇮🇳`) phone number format with a 24+ country dial code selector.
  - Mobile password login and One-Time OTP login flows.
  - Interactive 6-digit SMS verification with resend timer on registration.
  - Forgot password phone recovery flow.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + Custom CSS Variable Theme Engine
- **Icons**: [Lucide React](https://lucide.dev/)
- **Architecture**: Modular Frontend (`frontend/`) and Microservice-Ready Backend (`backend/`)

---

## 📁 Repository Structure

```text
chat-app/
├── frontend/                     # Next.js 16 Web Application
│   ├── app/                      # App router pages & layouts
│   │   ├── (auth)/               # Login, Register, Forgot Password
│   │   └── app/                  # Authenticated app routes (chats, contacts, groups, status, notifications, settings)
│   ├── components/               # Reusable UI, chat, layout components
│   ├── hooks/                    # Custom React hooks (theme, mobile, etc.)
│   ├── lib/                      # Mock datasets, utility helpers, themes
│   └── types/                    # TypeScript interfaces & models
├── backend/                      # Backend microservices roadmap & structure
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
