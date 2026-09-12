# 🚀 How to Run FluxChat (Complete Project Guide)

This guide provides step-by-step instructions to set up, configure, and run the entire **FluxChat** ecosystem — including the **Next.js 16 Frontend Web Client** and all **7 FastAPI Microservices** behind the **API Gateway**.

---

## ⚡ Quick Start (TL;DR)

If dependencies are already installed and environment variables configured:

```bash
# 1. Start all 7 backend microservices in background
./backend/start_all_backend.sh start

# 2. Check cluster health status
./backend/start_all_backend.sh status

# 3. Start the frontend development server
cd frontend
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.  
Explore API Gateway interactive documentation at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

To stop all backend services at any time:
```bash
./backend/start_all_backend.sh stop
```

---

## 📋 System Prerequisites

Ensure you have the following installed on your machine:

| Tool | Minimum Version | Recommended | Check Command |
|---|---|---|---|
| **Python** | 3.10+ | 3.11 / 3.12 / 3.14 | `python3 --version` |
| **Node.js** | 18.17+ | 20.x or 22.x LTS | `node --version` |
| **npm** | 9.x+ | 10.x+ | `npm --version` |
| **MongoDB** | 6.0+ or MongoDB Atlas | Live MongoDB Atlas Cluster | `mongosh --version` (optional) |
| **Git** | 2.x+ | Latest | `git --version` |

*(Optional)* **Redis** on `127.0.0.1:6379`. If Redis is not running locally, services automatically fall back gracefully to the high-performance in-memory event bus.

---

## ⚙️ 1. Environment Configuration

FluxChat strictly follows the **12-Factor App methodology**. Sensitive credentials are never hardcoded and are loaded dynamically from `.env` files.

### Backend Environment Setup
Create or ensure `backend/.env` exists (you can copy `backend/.env.production.example`):

```bash
cp backend/.env.production.example backend/.env
```

Ensure `backend/.env` contains your MongoDB Atlas connection string and secrets:
```env
APP_ENV=development
DEBUG=True

# MongoDB Connection String (MongoDB Atlas or local)
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster-address>/?appName=Chat
MONGODB_DATABASE=fluxchat_db

# JWT Configuration (Indefinite session until explicit logout)
JWT_SECRET=fluxchat-production-jwt-secret-key-32-chars-long-secure
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=5256000
REFRESH_TOKEN_EXPIRE_DAYS=3650

# Redis Connection (falls back to in-memory if offline)
REDIS_URL=redis://127.0.0.1:6379/0

# Microservices Network Routing
AUTH_SERVICE_URL=http://127.0.0.1:8001
USER_SERVICE_URL=http://127.0.0.1:8002
CHAT_SERVICE_URL=http://127.0.0.1:8003
MESSAGE_SERVICE_URL=http://127.0.0.1:8004
WS_SERVICE_URL=ws://127.0.0.1:8005
NOTIFICATION_SERVICE_URL=http://127.0.0.1:8006

# Security & CORS Quotas
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT=120
RATE_LIMIT_AUTH=25
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000
```

### Frontend Environment Setup
Create or verify `frontend/.env.local`:

```bash
# In frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## 🛠️ 2. First-Time Installation

### Step A: Install Backend Dependencies
From the repository root:

```bash
# 1. Create Python virtual environment inside backend/
python3 -m venv backend/venv

# 2. Activate virtual environment
source backend/venv/bin/activate

# 3. Upgrade pip and install all microservice dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step B: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### Step C: Verify Configuration Integrity
Run the built-in 12-factor configuration auditor:
```bash
./backend/venv/bin/python3 backend/verify_env.py
```
Expected output: `✔ 12-FACTOR AUDIT COMPLETE: ALL CONFIGURATIONS PASSED!`.

---

## 🏃 3. Running the Project

### Option 1: Automated Cluster Manager (Recommended)

From the project root, use the master cluster manager:

```bash
# Start all 7 backend services with auto-reload enabled
./backend/start_all_backend.sh start
```

This launches the following microservices in the background:
1. **API Gateway** on Port `8000`
2. **Auth Service** on Port `8001`
3. **User Service** on Port `8002`
4. **Chat Service** on Port `8003`
5. **Message Service** on Port `8004`
6. **WebSocket Service** on Port `8005`
7. **Notification Service** on Port `8006`

Now start the frontend in your terminal:
```bash
cd frontend
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser!

#### Managing the Backend Services:
- Check status of all services:
  ```bash
  ./backend/start_all_backend.sh status
  ```
- Restart all services:
  ```bash
  ./backend/start_all_backend.sh restart
  ```
- Stop all services:
  ```bash
  ./backend/start_all_backend.sh stop
  ```
- View service logs live:
  ```bash
  tail -f backend/logs/api-gateway.log
  tail -f backend/logs/auth-service.log
  tail -f backend/logs/user-service.log
  ```

---

### Option 2: Running Services Individually (Manual Multi-Terminal)

If you prefer running each service in a dedicated terminal window for live terminal debugging:

1. **Terminal 1 — API Gateway (Port 8000)**:
   ```bash
   ./backend/run_api_gateway.sh
   ```
2. **Terminal 2 — Auth Service (Port 8001)**:
   ```bash
   ./backend/run_auth_service.sh
   ```
3. **Terminal 3 — User & Contacts Service (Port 8002)**:
   ```bash
   ./backend/run_user_service.sh
   ```
4. **Terminal 4 — Conversation Service (Port 8003)**:
   ```bash
   ./backend/run_chat_service.sh
   ```
5. **Terminal 5 — Message Service (Port 8004)**:
   ```bash
   ./backend/run_message_service.sh
   ```
6. **Terminal 6 — WebSocket Service (Port 8005)**:
   ```bash
   ./backend/run_websocket_service.sh
   ```
7. **Terminal 7 — Notification Service (Port 8006)**:
   ```bash
   ./backend/run_notification_service.sh
   ```
8. **Terminal 8 — Frontend Web App (Port 3000)**:
   ```bash
   cd frontend && npm run dev
   ```

---

### Option 3: Docker Compose

To start the entire backend and Redis in isolated containers:

```bash
docker compose up -d
```

---

## 🌐 4. Microservices Ingress & Ports Matrix

| Service | Port | Base Path | Swagger Docs | Health Check |
|---|---|---|---|---|
| **Frontend Web App** | `3000` | `/` | — | `http://localhost:3000` |
| **API Gateway Ingress** | `8000` | `/api/v1` | [Docs (:8000)](http://localhost:8000/docs) | [Health (:8000)](http://localhost:8000/health) |
| **Auth Service** | `8001` | `/api/v1/auth` | [Docs (:8001)](http://localhost:8001/docs) | [Health (:8001)](http://localhost:8001/health) |
| **User & Contacts Service** | `8002` | `/api/v1/users` | [Docs (:8002)](http://localhost:8002/docs) | [Health (:8002)](http://localhost:8002/health) |
| **Chat & Conversations** | `8003` | `/api/v1/conversations` | [Docs (:8003)](http://localhost:8003/docs) | [Health (:8003)](http://localhost:8003/health) |
| **Message Service** | `8004` | `/api/v1/messages` | [Docs (:8004)](http://localhost:8004/docs) | [Health (:8004)](http://localhost:8004/health) |
| **WebSocket Service** | `8005` | `/api/v1/ws` | [Docs (:8005)](http://localhost:8005/docs) | [Health (:8005)](http://localhost:8005/health) |
| **Notification Service** | `8006` | `/api/v1/notifications` | [Docs (:8006)](http://localhost:8006/docs) | [Health (:8006)](http://localhost:8006/health) |

---

## 🧪 5. Testing & Verification

### Running Automated Test Harness
FluxChat includes an end-to-end regression test suite covering all 9 test suites across all services:

```bash
./backend/run_all_tests.sh
```

**Test Suites Covered:**
1. Unified Health Probes
2. 12-Factor Config Validation
3. Auth Service Unit & Integration
4. User & Contacts Service
5. Chat Service
6. Message Service
7. WebSocket Service & Real-Time Presence
8. Notification Service
9. End-to-End User Journey (Gateway -> Auth -> Contacts -> Direct Chat -> Messages -> WebSocket)

### Building Frontend Production Bundle
```bash
cd frontend
npm run build
```

---

## 🔧 6. Troubleshooting & FAQs

### Q: Port already in use (e.g. `Address already in use: 8000`)
Run the cleanup command or stop the cluster:
```bash
./backend/start_all_backend.sh stop

# Or find and terminate specific port process:
lsof -ti :8000 | xargs kill -9
```

### Q: MongoDB Atlas connection fails or timeouts
1. Verify `MONGODB_URL` in `backend/.env`.
2. Ensure your current IP address is whitelisted in **MongoDB Atlas Network Access** (`0.0.0.0/0` or current IP).
3. Test connection directly:
   ```bash
   ./backend/venv/bin/python3 -c "import certifi; from motor.motor_asyncio import AsyncIOMotorClient; import asyncio; client = AsyncIOMotorClient('YOUR_MONGODB_URL', tlsCAFile=certifi.where()); asyncio.run(client.admin.command('ping')); print('MongoDB Atlas Connected!')"
   ```

### Q: Changes to code not reflecting?
All backend runner scripts run with `--reload-dir "$DIR"` which automatically watches the file system and reloads services on code changes. If a service needs a hard restart:
```bash
./backend/start_all_backend.sh restart
```

---

## 📄 License

This project is licensed under the MIT License.
