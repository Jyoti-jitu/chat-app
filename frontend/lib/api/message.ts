/**
 * Message Service REST API client for FluxChat.
 * Interfaces with the FastAPI Message Service running on port 8004.
 */

export const MESSAGE_SERVICE_URL =
  process.env.NEXT_PUBLIC_MESSAGE_SERVICE_URL || "http://localhost:8004/api/v1";

export interface MessageAttachmentItem {
  name: string;
  size: string;
  url: string;
  type: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: "text" | "image" | "file" | "audio";
  attachment?: MessageAttachmentItem | null;
  reply_to?: string | null;
  status: "sent" | "delivered" | "read";
  edited: boolean;
  deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MessageListResponse {
  items: MessageItem[];
  total: number;
  next_cursor?: string | null;
  has_more?: boolean;
}

export interface SendMessagePayload {
  content: string;
  type?: "text" | "image" | "file" | "audio";
  attachment?: MessageAttachmentItem | null;
  reply_to?: string | null;
}

import { getStoredToken } from "./auth";

function getAuthHeader(token?: string): Record<string, string> {
  const authToken = token || getStoredToken();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/**
 * Sends a new message in a conversation thread.
 */
export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload,
  token?: string
): Promise<MessageItem> {
  const res = await fetch(
    `${MESSAGE_SERVICE_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to send message (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retrieves message history for a conversation thread with cursor pagination.
 */
export async function getMessages(
  conversationId: string,
  limit: number = 30,
  cursor?: string,
  token?: string
): Promise<MessageListResponse> {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  const res = await fetch(
    `${MESSAGE_SERVICE_URL}/conversations/${conversationId}/messages?limit=${limit}${cursorParam}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch messages (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Edits an existing message (Author only).
 */
export async function editMessage(
  messageId: string,
  content: string,
  token?: string
): Promise<MessageItem> {
  const res = await fetch(`${MESSAGE_SERVICE_URL}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to edit message (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Soft deletes a message (Author only).
 */
export async function deleteMessage(
  messageId: string,
  token?: string
): Promise<MessageItem> {
  const res = await fetch(`${MESSAGE_SERVICE_URL}/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete message (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Marks a message as read.
 */
export async function markMessageAsRead(
  messageId: string,
  token?: string
): Promise<MessageItem> {
  const res = await fetch(`${MESSAGE_SERVICE_URL}/messages/${messageId}/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to mark message as read (HTTP ${res.status})`);
  }

  return res.json();
}
