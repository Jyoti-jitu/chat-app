# NovaChat Backend — Modular FastAPI Architecture

This directory is reserved for the backend implementation scheduled for **Phase 7 through Phase 17**.

## Planned Microservices Structure

```text
backend/
├── api-gateway/            # Phase 14: Central reverse proxy & routing
├── auth-service/           # Phase 8: JWT generation, validation, tokens
├── user-service/           # Phase 9: Profile, online status, search
├── chat-service/           # Phase 10: 1:1 and group conversations
├── message-service/        # Phase 11: Message persistence & history
├── notification-service/   # Phase 13: In-app & external alerts
├── websocket-service/      # Phase 12: Real-time connection management
├── shared/                 # Common schemas, security, DB utilities
└── docker-compose.yml      # Phase 17: Container orchestration
```

> **Development Rule:** Per the roadmap, backend development will commence after the frontend architecture (Phases 1-6) is complete and verified.
