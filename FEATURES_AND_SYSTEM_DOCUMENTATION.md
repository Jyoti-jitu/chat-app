# 🚀 FluxChat: Enterprise Features & Complete System Documentation

This document provides a comprehensive technical reference for all features, architecture components, API endpoints, data models, and deployment configurations implemented across FluxChat.

---

## 📑 Table of Contents
1. [Core Features Overview](#-1-core-features-overview)
2. [Cloudinary Centralized Media Management](#-2-cloudinary-centralized-media-management)
3. [24-Hour Auto-Expiring Status & Stories](#-3-24-hour-auto-expiring-status--stories)
4. [Permanent Conversation & Message Data Purge](#-4-permanent-conversation--message-data-purge)
5. [Group Management & Join Approval Policies](#-5-group-management--join-approval-policies)
6. [Redis Message Caching & Instant Delivery](#-6-redis-message-caching--instant-delivery)
7. [Dynamic User Profiles](#-7-dynamic-user-profiles)
8. [Messaging Glitch & Real-Time Sync Fixes](#-8-messaging-glitch--real-time-sync-fixes)
9. [New Files & Architectural Inventory](#-9-new-files--architectural-inventory)
10. [Production Environment Configuration](#-10-production-environment-configuration)

---

## 🌟 1. Core Features Overview

| Feature Area | Key Capability | Implementation Highlights |
| :--- | :--- | :--- |
| **Cloudinary Media** | All images, attachments, avatars, and covers stored in Cloudinary | Centralized media service, folder segregation, automatic CDN URL storage, full-screen lightbox |
| **Status / Stories** | 24-hour self-destructing photo & text updates | MongoDB TTL query (`expires_at > now`), strict privacy filtering (contacts only), multi-segment viewer |
| **Data Purge** | Irreversible conversation & message deletion | Wipes string IDs, ObjectIds, `c_` virtual IDs, resets thread metadata, purges Redis cache |
| **Groups** | Full group controls with admin approval | Creator founding admin rights, "Anyone can join" vs "Admin approval", admin modal for join requests |
| **Redis Caching** | High-throughput message retrieval | Redis caching on chat open (`cache:messages:{id}:{limit}`), cache invalidation, optimistic UI update |
| **Dynamic Profiles** | Customizable user identities | Upload avatars and cover images, set `@username`, phone number, and social/website links |
| **Real-Time Messaging** | Rock-solid chat thread synchronization | Double green checkmarks (read receipts), auto-reconnect backoff, typing debouncing, message editing |

---

## ☁️ 2. Cloudinary Centralized Media Management

All user-generated media routes through a centralized Cloudinary engine:
- **Backend Service**: [`backend/shared/media/cloudinary_service.py`](backend/shared/media/cloudinary_service.py)
- **API Gateway Endpoint**: [`backend/services/api-gateway/app/api/v1/media.py`](backend/services/api-gateway/app/api/v1/media.py)
- **Frontend Client**: [`frontend/lib/api/media.ts`](frontend/lib/api/media.ts)

### Folder Hierarchy in Cloudinary:
```text
fluxchat/
├── avatars/     # User profile photos
├── covers/      # Profile background cover banners
├── chat/        # Message attachments (photos, documents)
├── status/      # 24-hour status story media
├── groups/      # Group conversation avatars
└── demo/        # Integration test verification assets
```

### Endpoints:
- `POST /api/v1/media/upload`: Multipart form data upload (`file`, `folder`). Returns `{ url, secure_url, public_id, size, format }`.
- `POST /api/v1/media/upload-base64`: Direct base64 or Data URI string upload.

### Interactive Lightbox:
When a user clicks on an image in the chat stream:
- An interactive full-screen modal overlays the screen with backdrop blur.
- Includes smooth zoom transitions and a direct **Download** button to download the original media from the Cloudinary CDN.

---

## ⏱️ 3. 24-Hour Auto-Expiring Status & Stories

Users can share updates that automatically vanish after 24 hours:
- **Backend Service**: [`backend/services/user-service/app/services/status_service.py`](backend/services/user-service/app/services/status_service.py)
- **Frontend Page**: [`frontend/app/app/status/page.tsx`](frontend/app/app/status/page.tsx)
- **API Client**: [`frontend/lib/api/status.ts`](frontend/lib/api/status.ts)

### How It Works:
1. **Creation**:
   - **Photo Story**: File selected ➔ uploaded to Cloudinary (`fluxchat/status`) ➔ slide saved with photo URL and caption.
   - **Text Story**: Custom message with selectable vibrant background gradients and 4 typography styles (`modern`, `serif`, `mono`, `bold`).
2. **24-Hour Expiration**:
   - On creation, the backend sets:
     ```python
     expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
     ```
   - Feed queries enforce `{"slides.expires_at": {"$gt": datetime.now(timezone.utc)}}`.
3. **Contact-Only Privacy**:
   - The status feed strictly returns slides belonging to `[current_user_id] + connected_contact_ids` (accepted bilateral connections). Non-connected users cannot see your status.
4. **Viewer Features**:
   - Multi-segment story progress bars with 5-second automatic progression.
   - Quick reaction emojis (`❤️`, `🔥`, `😂`, `👏`, `🎉`, `🚀`).
   - Reply form sending a direct chat reply to the story author.
   - Slide deletion for the author.

---

## 🗑️ 4. Permanent Conversation & Message Data Purge

When a user deletes a conversation:
- **Backend Chat Service**: [`conversation_service.py`](backend/services/chat-service/app/services/conversation_service.py)
- **Backend Message Service**: [`message_service.py`](backend/services/message-service/app/services/message_service.py)

### Purge Mechanism:
1. **Virtual Contact Resolution**: If the target ID is formatted as `c_<recipientId>`, the backend automatically looks up the canonical MongoDB direct conversation.
2. **Comprehensive Message Purge**:
   - Deletes all records from the MongoDB `messages` collection where:
     - `conversation_id == str(conv_id)`
     - `conversation_id == ObjectId(conv_id)`
     - `conversation_id == "c_..."`
     - Bilateral messages matching `(sender == userA AND recipient == userB)` or `(sender == userB AND recipient == userA)`
3. **Metadata Reset**:
   - `last_message` is reset to `None`.
   - `unread_counts` are zeroed.
4. **Cache Invalidation**:
   - Purges all matching Redis keys (`cache:messages:{conv_id}:*`).
5. **Frontend Continuity**:
   - Completely cleans up local state and redirects to `/app/chats`.

---

## 👥 5. Group Management & Join Approval Policies

Any user can create a group and administer members:
- **Group Settings Modal**: [`frontend/components/chat/GroupSettingsModal.tsx`](frontend/components/chat/GroupSettingsModal.tsx)
- **Conversation List Modal**: [`frontend/components/chat/ConversationList.tsx`](frontend/components/chat/ConversationList.tsx)
- **API Client**: [`frontend/lib/api/chat.ts`](frontend/lib/api/chat.ts)

### Key Capabilities:
- **Founding Admin**: The creator is recorded in `admin_ids` upon creation.
- **Join Policies**:
  - `open` (**Anyone Can Join**): Users who click the invite link or submit a join request join immediately.
  - `approval` (**Admin Approval Required**): Requests are placed into `join_requests`.
- **Admin Dashboard**:
  - **General Settings**: Edit Group Name, Description, Group Avatar (via Cloudinary), and toggle Join Policy.
  - **Join Requests**: Review pending requests with one-click **Approve** or **Reject** actions.
  - **Members List**: Search members, **Promote to Admin** (`admin_ids`), or **Remove Member**.
  - **Invite Link**: One-click copy for `https://fluxchat.app/app/groups/join/{id}`.
- **Chat Header**:
  - Displays `Group` badge and a gear icon with a notification dot when join requests are pending.

---

## ⚡ 6. Redis Message Caching & Instant Delivery

Fast message delivery backed by distributed caching:
- **Message Service**: [`backend/services/message-service/app/services/message_service.py`](backend/services/message-service/app/services/message_service.py)
- **Chat Thread UI**: [`frontend/app/app/chats/[conversationId]/page.tsx`](frontend/app/app/chats/[conversationId]/page.tsx)

### Cache Flow:
1. When opening a conversation, `GET /api/v1/conversations/{id}/messages` checks Redis key `cache:messages:{convId}:{limit}`.
2. **Cache Hit**: Instant response from Redis cache.
3. **Cache Miss**: Reads from MongoDB, stores in Redis with a 5-minute TTL, and returns payload.
4. **Cache Invalidation**: Automatically clears `cache:messages:{convId}:*` on:
   - New message sent (`POST /api/v1/conversations/{id}/messages`)
   - Chat history cleared (`DELETE /api/v1/conversations/{id}/messages`)
   - Conversation deleted (`DELETE /api/v1/conversations/{id}`)
5. **Optimistic Frontend Updates**:
   - Outgoing messages appear in the chat stream immediately with a temporary ID.
   - When the server confirms delivery, the temporary message seamlessly transitions to the confirmed ID.
   - Incoming WebSocket messages (`message.new`) append to the active thread with zero delay.

---

## 👤 7. Dynamic User Profiles

- **Profile Page**: [`frontend/app/app/profile/page.tsx`](frontend/app/app/profile/page.tsx)
- **User Service**: [`backend/services/user-service/app/services/user_service.py`](backend/services/user-service/app/services/user_service.py)

### Capabilities:
- **Profile Photo**: Upload custom photo stored on Cloudinary with client compression fallback.
- **Cover Banner**: Upload custom background image banner with hover zoom effect and "Change Cover" shortcut.
- **Identity Fields**: Edit Full Name, `@username` (with uniqueness checks), and Phone Number.
- **Personal Links**: Add website, portfolio, or social link (renders as external link card with Globe icon).
- **Live Sync**: Uses custom `fluxchat:profile_updated` event so changes in the profile modal immediately update the sidebar avatar, header, and active chats across browser tabs.

---

## 🛠️ 8. Messaging Glitch & Real-Time Sync Fixes

- **Double Green Checkmarks**: `wsClient.on("message.read")` updates checkmarks dynamically from single check (`sent`) to double green checks (`read`).
- **Resilient Reconnection**: Exponential backoff capped at 8s, reconnecting immediately on window `focus` or `online` events.
- **Typing Indicator**: Debounced typing detection (2.5s) triggers `typing.start` and clean `typing.stop`.
- **Edit & Reply Banners**: Reply quote banners with preview snippet and message editing with `(edited)` tag.
- **Non-Author Message Deletion**: "Delete for everyone" for authors, "Remove for me" for non-authors (avoids 403 Forbidden errors).
- **Smart Auto-Scroll**: Only scrolls to bottom if user is already near bottom (< 150px), sent the message, or opened the chat.

---

## 📁 9. New Files & Architectural Inventory

| Component | File Path | Purpose |
| :--- | :--- | :--- |
| **Cloudinary Engine** | `backend/shared/media/cloudinary_service.py` | Centralized SDK wrapper for multipart & base64 uploads |
| **Media API Gateway** | `backend/services/api-gateway/app/api/v1/media.py` | Authenticated upload endpoint (`/api/v1/media/upload`) |
| **Media Client** | `frontend/lib/api/media.ts` | Frontend upload helper functions (`uploadMedia`, `uploadBase64`) |
| **Status API Gateway** | `backend/services/user-service/app/api/v1/status.py` | Status endpoints (`POST`, `GET`, `DELETE`) |
| **Status Service** | `backend/services/user-service/app/services/status_service.py` | 24h TTL logic and bilateral contact filtering |
| **Status Repository** | `backend/services/user-service/app/repositories/status_repository.py` | MongoDB operations on `status_stories` collection |
| **Status Schemas** | `backend/services/user-service/app/schemas/status.py` | Pydantic validation schemas for slides and feeds |
| **Status Client** | `frontend/lib/api/status.ts` | Frontend API client for stories |
| **Group Settings Modal** | `frontend/components/chat/GroupSettingsModal.tsx` | Admin dashboard for group settings, approvals & members |

---

## 🚀 10. Production Environment Configuration

### Backend Environment Variables (Render / Server)
Set these in your **Render Dashboard ➔ Environment**:

```env
# MongoDB Atlas
MONGODB_URL=mongodb+srv://<username>:<password>@chat.njrcbvy.mongodb.net/?appName=Chat
MONGODB_DATABASE=fluxchat_db

# Security
JWT_SECRET=fluxchat-production-jwt-secret-key-32-chars-long-secure
JWT_ALGORITHM=HS256

# CORS Origins
CORS_ORIGINS=http://localhost:3000,https://*.vercel.app

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=pygfnzvb
CLOUDINARY_API_KEY=831858532965517
CLOUDINARY_API_SECRET=jme2IYi7dXs4glAbd8dW8B0AbwU
CLOUDINARY_URL=cloudinary://831858532965517:jme2IYi7dXs4glAbd8dW8B0AbwU@pygfnzvb
```

### Frontend Environment Variables (Vercel)
Set these in your **Vercel Project Settings ➔ Environment Variables** (use **`visibility: config`** / Plaintext):

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com/ws
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=pygfnzvb
```

---

*FluxChat is built with Next.js 16 (React 19), FastAPI, MongoDB Atlas, Redis, and Cloudinary.*
