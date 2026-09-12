# 🚀 FluxChat Production Deployment Guide: Vercel (Frontend) & Render (Backend)

This guide walks you through deploying **FluxChat** to production in **under 10 minutes** using:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 16 + React 19)
- **Backend**: [Render](https://render.com) (FastAPI Microservices Cluster + API Gateway Ingress)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Free M0 Tier)

---

## 🏛️ Production Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Vercel Edge Platform    │
                          │   https://app.vercel.app  │
                          │     (Next.js Frontend)    │
                          └─────────────┬─────────────┘
                                        │
           HTTPS REST API               │             WSS WebSocket Tunnel
           https://...onrender.com      │             wss://...onrender.com/ws
                                        ▼
                          ┌───────────────────────────┐
                          │    Render Web Service     │
                          │ ╔═══════════════════════╗ │
                          │ ║  API Gateway (:PORT)  ║ │
                          │ ╚═══════════╦═══════════╝ │
                          │             │             │
                          │  ┌──────────┼──────────┐  │
                          │  │ Internal Proxy Bus  │  │
                          │  ▼          ▼          ▼  │
                          │ Auth      User       Chat │
                          │:8001     :8002      :8003 │
                          │                           │
                          │ Message    WS        Notif│
                          │:8004     :8005      :8006 │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │     MongoDB Atlas M0      │
                          │    fluxchat_db Cluster    │
                          └───────────────────────────┘
```

---

## Step 1: Set Up Free MongoDB Atlas Database (2 minutes)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Click **Create Deployment** and select the **M0 Free Tier**.
3. Under **Security Quickstart**:
   - **Database User**: Create a username (e.g. `fluxchat_admin`) and secure password.
   - **Network Access**: Add `0.0.0.0/0` (Allow Access from Anywhere) so Render can connect.
4. Click **Connect** -> **Drivers** -> **Python**.
5. Copy your connection string:
   ```text
   mongodb+srv://fluxchat_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your database password).*

---

## Step 2: Deploy Backend Cluster to Render (4 minutes)

You can deploy the backend using either **Method A (Render Blueprint - Recommended)** or **Method B (Manual Web Service)**.

### Method A: Using Render Blueprint (1-Click)

1. Go to [Render Dashboard](https://dashboard.render.com/) -> Click **New +** -> **Blueprint**.
2. Connect your GitHub repository (`chat-app`).
3. Render will automatically read [`render.yaml`](../render.yaml).
4. Fill in the prompted secret variables:
   - `MONGODB_URL`: Your MongoDB Atlas connection string from Step 1.
   - `TWO_FACTOR_API_KEY`: Your 2Factor API key (for Indian SMS/voice OTP).
5. Click **Apply**. Render will automatically build the multi-stage Docker container and deploy the cluster!

---

### Method B: Manual Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/) -> Click **New +** -> **Web Service**.
2. Connect your GitHub repository (`chat-app`).
3. Configure the service settings:
   - **Name**: `fluxchat-backend`
   - **Region**: Oregon (or Frankfurt)
   - **Language / Runtime**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile.render`
   - **Docker Context**: `backend`
   - **Instance Type**: `Free`
4. In **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `MONGODB_URL` | `mongodb+srv://...` | From Step 1 |
   | `MONGODB_DATABASE` | `fluxchat_db` | Default database |
   | `JWT_SECRET` | *(click Generate)* | 32+ character random secret |
   | `TWO_FACTOR_API_KEY` | *(your 2Factor key)* | For SMS/voice verification |
   | `CORS_ORIGINS` | `http://localhost:3000,https://*.vercel.app` | Allowed origins |
   | `ENVIRONMENT` | `production` | Production mode |
5. In **Health Check Path**, enter: `/health`.
6. Click **Create Web Service**.

Once deployed, copy your Render public URL:
👉 `https://fluxchat-backend.onrender.com`

---

## Step 3: Deploy Frontend to Vercel (3 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/new) -> Click **Add New Project**.
2. Import your GitHub repository (`chat-app`).
3. In the project configuration:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `frontend`.
4. In **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://fluxchat-backend.onrender.com` |
   | `NEXT_PUBLIC_WS_URL` | `wss://fluxchat-backend.onrender.com/ws` |

   *(Replace `https://fluxchat-backend.onrender.com` with your actual Render URL from Step 2).*

5. Click **Deploy**. Vercel will build and launch your application in ~45 seconds!
   👉 Your live frontend URL will be: `https://your-fluxchat-app.vercel.app`

---

## Step 4: Verification & Live Smoke Test

1. **Verify Backend Gateway Health**:
   Open `https://your-backend.onrender.com/health` in your browser. You should receive:
   ```json
   {
     "status": "healthy",
     "gateway": "operational",
     "timestamp": "...",
     "downstream": { ... }
   }
   ```
2. **Open Frontend on Vercel**:
   Navigate to `https://your-fluxchat-app.vercel.app`.
3. **Register an Account**:
   - Go to `/register`.
   - Enter your name, username, mobile number.
   - Enter matching passwords: verify the real-time green checkmark appears.
   - Enter OTP code and submit.
4. **Test Real-Time Chat & Sockets**:
   - Open two browser tabs (or an incognito window with a second user).
   - Add the second user as a contact.
   - Send a message: observe real-time delivery via WebSocket tunnel!

---

## 🛠️ Production Configuration Reference

### Environment Variables Cheat Sheet

#### Frontend (`frontend/.env.production.example`)
```env
NEXT_PUBLIC_API_URL=https://fluxchat-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://fluxchat-backend.onrender.com/ws
```

#### Backend (`backend/.env.production.example`)
```env
MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/fluxchat_db?retryWrites=true&w=majority
MONGODB_DATABASE=fluxchat_db
JWT_SECRET=super_secure_32_character_jwt_secret_key
TWO_FACTOR_API_KEY=your_2factor_api_key
CORS_ORIGINS=http://localhost:3000,https://*.vercel.app
ENVIRONMENT=production
RATE_LIMIT_ENABLED=true
```

---

## ❓ Frequently Asked Questions (FAQ)

#### Q: Do I need 7 separate web services on Render?
**No.** The provided `backend/Dockerfile.render` uses a unified container architecture. The internal microservices run on internal loopback ports (`8001`-`8006`), while the API Gateway handles public traffic on Render's assigned `$PORT`. This means the entire backend runs on **1 single Render Web Service** (fully compatible with the Free tier).

#### Q: How are WebSockets handled on Render?
Render natively supports persistent WebSockets with zero extra configuration. The API Gateway forwards `/ws` connections directly to the internal WebSocket service.

#### Q: How does CORS work between Vercel and Render?
The API Gateway includes `allow_origin_regex=r"https://.*\.vercel\.app"`. Any branch preview or production domain deployed on Vercel is automatically authorized to communicate with the Render API.

#### Q: How does Render handle cold starts on the Free tier?
Render free instances spin down after 15 minutes of inactivity. When a request arrives, Render spins up the container in ~30 seconds. The startup script uses internal health checks to ensure all microservices are ready before serving client traffic.
