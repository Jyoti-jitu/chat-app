# FluxChat — Auth Service

The **Auth Service** is the identity and authentication microservice for the FluxChat platform.

---

## 🏗️ Architecture Layering

```text
api/v1/router.py   ──>   HTTP Routing & Request/Response Contracts
       ↓
   services/       ──>   Business Logic Layer
       ↓
 repositories/     ──>   Data Persistence & Database Abstraction
       ↓
    models/        ──>   Data Document Definitions
```

---

## 🚀 Running the Service (Phase 1)

### 1. Activate Environment

```bash
cd backend
source venv/bin/activate
```

### 2. Install Dependencies

```bash
cd services/auth-service
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

### 4. Start Development Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 📡 Endpoints (Phase 1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root service descriptor with documentation & health links |
| `GET` | `/health` | Service operational health check |
| `GET` | `/api/v1/health` | Versioned API v1 health check |
| `GET` | `/docs` | Swagger / OpenAPI Interactive Documentation |
| `GET` | `/redoc` | ReDoc API Reference |
