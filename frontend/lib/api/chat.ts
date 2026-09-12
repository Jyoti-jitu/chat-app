/**
 * Chat & Conversation Service REST API client for FluxChat.
 * Interfaces with the FastAPI Chat Service running on port 8003.
 */

export const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || "http://localhost:8003/api/v1";

export interface ConversationMember {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  is_online: boolean;
  last_seen?: string | null;
}

export interface LastMessagePreview {
  id?: string | null;
  sender_id?: string | null;
  content?: string | null;
  timestamp?: string | null;
}

export interface ConversationItem {
  id: string;
  type: "direct" | "group";
  name?: string | null;
  avatar?: string | null;
  member_ids: string[];
  members: ConversationMember[];
  admins: string[];
  created_by?: string | null;
  last_message?: LastMessagePreview | null;
  unread_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ConversationListResponse {
  items: ConversationItem[];
  total: number;
}

export interface CreateDirectConversationPayload {
  recipient_id: string;
}

export interface CreateGroupConversationPayload {
  name: string;
  member_ids: string[];
  avatar?: string;
}

export interface UpdateGroupConversationPayload {
  name?: string;
  avatar?: string;
}

import { ActionSuccessResponse } from "./contact";
import { getStoredToken } from "./auth";

function getAuthHeader(token?: string): Record<string, string> {
  const authToken = token || getStoredToken();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/**
 * Creates or retrieves a direct 1:1 conversation between the authenticated user and recipient.
 */
export async function createOrGetDirectConversation(
  recipientId: string,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify({ recipient_id: recipientId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to create/get direct conversation (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Creates a new named group conversation.
 */
export async function createGroupConversation(
  payload: CreateGroupConversationPayload,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to create group conversation (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Lists all active conversations for the authenticated user.
 */
export async function getConversations(
  limit: number = 50,
  skip: number = 0,
  token?: string
): Promise<ConversationListResponse> {
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations?limit=${limit}&skip=${skip}`,
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
    throw new Error(
      errorData.detail || `Failed to fetch conversations (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Fetches details for a specific conversation by ID.
 */
export async function getConversationDetails(
  conversationId: string,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch conversation details (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Updates group conversation title or avatar.
 */
export async function updateGroupConversation(
  conversationId: string,
  payload: UpdateGroupConversationPayload,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to update group conversation (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Adds participants to a group conversation.
 */
export async function addConversationMembers(
  conversationId: string,
  memberIds: string[],
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify({ member_ids: memberIds }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to add participants (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Removes a participant from a group conversation.
 */
export async function removeConversationMember(
  conversationId: string,
  targetUserId: string,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations/${conversationId}/members/${targetUserId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to remove participant (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Voluntarily leaves a conversation.
 */
export async function leaveConversation(
  conversationId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to leave conversation (HTTP ${res.status})`
    );
  }

  return res.json();
}
