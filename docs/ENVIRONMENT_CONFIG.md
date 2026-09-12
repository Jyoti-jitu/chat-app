# 🌍 FluxChat Enterprise: Environment Configuration & 12-Factor Guide

This document defines the configuration standards, security rules, and production readiness checklists for the **FluxChat** distributed microservice platform in accordance with the [Twelve-Factor App methodology](https://12factor.net/config).

---

## 1. Twelve-Factor Methodology: III. Config

> *"Store config in the environment."*

- **Zero Hardcoded Secrets**: Secrets (passwords, JWT keys, API tokens, database URIs) must never appear in source code or version control.
- **Strict Separation of Config and Code**: Code is compiled and packaged once (e.g. Docker images), and deployed identically across development, staging, and production environments with configuration injected solely via environment variables.
- **Fail-Fast Bootstrapping**: Any service booting in `production` mode with invalid or default developer secrets fails immediately at startup.

---

## 2. Cluster Configuration Matrix

| Variable | Type | Default / Example | Required In Prod | Services Consuming |
|---|---|---|---|---|
| `APP_NAME` | string | `"FluxChat"` | No | All services |
| `APP_ENV` | enum | `development` (`staging`, `production`) | **Yes** | All services |
| `DEBUG` | boolean | `false` | **Yes** | All services |
| `LOG_LEVEL` | enum | `INFO` (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | No | All services |
| `MONGODB_URL` | string (URI) | `mongodb+srv://user:pass@cluster.mongodb.net/?...` | **Yes** | Auth, User, Chat, Message, Notification |
| `MONGODB_DATABASE` | string | `fluxchat_db` | **Yes** | Auth, User, Chat, Message, Notification |
| `REDIS_URL` | string (URI) | `redis://redis:6379/0` | **Yes** | WebSocket, Notification, Auth, User, Chat, Message |
| `JWT_SECRET` | string | *(Min 32 random characters)* | **Yes** | Auth, User, Chat, Message, WebSocket, Notification |
| `JWT_ALGORITHM` | string | `HS256` | No | Auth, User, Chat, Message, WebSocket, Notification |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | `15` | No | Auth Service |
| `REFRESH_TOKEN_EXPIRE_DAYS` | int | `30` | No | Auth Service |
| `TWO_FACTOR_API_KEY` | string | *(2Factor.in API Key)* | Optional | Auth Service (Falls back to sandbox OTP) |
| `AUTH_SERVICE_URL` | string (URL) | `http://auth-service:8001` | **Yes** | API Gateway |
| `USER_SERVICE_URL` | string (URL) | `http://user-service:8002` | **Yes** | API Gateway |
| `CHAT_SERVICE_URL` | string (URL) | `http://chat-service:8003` | **Yes** | API Gateway |
| `MESSAGE_SERVICE_URL`| string (URL) | `http://message-service:8004`| **Yes** | API Gateway |
| `WS_SERVICE_URL` | string (URL) | `ws://websocket-service:8005`| **Yes** | API Gateway |
| `NOTIFICATION_SERVICE_URL` | string (URL) | `http://notification-service:8006` | **Yes** | API Gateway |
| `CORS_ORIGINS` | string | `http://localhost:3000` | **Yes** | API Gateway, All Services |
| `NEXT_PUBLIC_API_URL`| string (URL) | `http://localhost:8000` | **Yes** | Next.js Frontend |
| `NEXT_PUBLIC_WS_URL` | string (URL) | `ws://localhost:8000/ws` | **Yes** | Next.js Frontend |

---

## 3. Cryptographic Secret Generation

Never reuse development secrets in production. Generate high-entropy secrets using standard cryptographic tools:

### Generate 64-character hex secret:
```bash
openssl rand -hex 32
```

### Python one-liner:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 4. Production Readiness Checklist

Before deploying FluxChat to production:

- [ ] **Secret Entropy**: `JWT_SECRET` is at least 32 characters and does not match any development placeholders.
- [ ] **MongoDB Atlas**:
  - `MONGODB_URL` uses TLS/SSL (`mongodb+srv://` with `retryWrites=true&w=majority`).
  - IP Access List / VPC peering configured to permit traffic only from backend container subnets.
  - Least-privilege MongoDB database user created specifically for FluxChat.
- [ ] **Redis Broker**:
  - `REDIS_URL` points to high-availability Redis (e.g. AWS ElastiCache / Redis Cloud).
  - Password protection enabled (`redis://:password@host:port/0` or `rediss://` for TLS).
- [ ] **Environment Validation**:
  - Run the automated auditor:
    ```bash
    python3 backend/verify_env.py
    ```
- [ ] **Frontend Build**:
  - Compile the standalone Next.js bundle:
    ```bash
    cd frontend && npm run build
    ```

---

## 5. Automated Environment Diagnostic Tool

FluxChat includes an automated CLI environment auditor at [`backend/verify_env.py`](file:///Users/apple/Desktop/project/chat-app/backend/verify_env.py):

```bash
cd backend
./venv/bin/python verify_env.py
```

It inspects all cluster `.env` files, validates URI syntax, verifies secret entropy, and reports configuration health with zero side-effects.
