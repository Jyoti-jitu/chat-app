/**
 * Chat & Conversation Service REST API client for FluxChat.
 * Interfaces with the FastAPI Chat Service running on port 8003.
 */

export const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVICE_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : "http://localhost:8003/api/v1");

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
  sender_name?: string | null;
  content?: string | null;
  timestamp?: string | null;
}

export interface ConversationItem {
  id: string;
  type: "direct" | "group";
  name?: string | null;
  avatar?: string | null;
  description?: string | null;
  join_mode?: "open" | "approval";
  member_ids: string[];
  members: ConversationMember[];
  admins: string[];
  created_by?: string | null;
  join_requests?: GroupJoinRequestItem[];
  last_message?: LastMessagePreview | null;
  unread_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GroupJoinRequestItem {
  user_id: string;
  name: string;
  username: string;
  avatar?: string | null;
  requested_at?: string | null;
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
  member_ids?: string[];
  avatar?: string;
  description?: string;
  join_mode?: "open" | "approval";
}

export interface UpdateGroupConversationPayload {
  name?: string;
  avatar?: string;
  description?: string;
  join_mode?: "open" | "approval";
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

export const removeMemberFromGroup = removeConversationMember;

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

/**
 * Permanently deletes a conversation and all its messages.
 */
export async function deleteConversation(
  conversationId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to delete conversation (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Permanently clears all messages in a conversation.
 */
export async function clearConversationMessages(
  conversationId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/messages`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to clear messages (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Joins an open group or submits a join request if approval is required.
 */
export async function joinGroup(
  conversationId: string,
  token?: string
): Promise<{ status: string; message: string; conversation?: ConversationItem }> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to join group (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retrieves pending join requests for an approval-based group (Admin only).
 */
export async function getGroupJoinRequests(
  conversationId: string,
  token?: string
): Promise<GroupJoinRequestItem[]> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/join-requests`, {
    headers: {
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch join requests (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Approves a user's join request to a group (Admin only).
 */
export async function approveGroupJoinRequest(
  conversationId: string,
  targetUserId: string,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations/${conversationId}/join-requests/${targetUserId}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to approve join request (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Rejects a user's join request to a group (Admin only).
 */
export async function rejectGroupJoinRequest(
  conversationId: string,
  targetUserId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations/${conversationId}/join-requests/${targetUserId}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to reject join request (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Updates group settings (join mode, avatar, description, name). Admin only.
 */
export async function updateGroupSettings(
  conversationId: string,
  payload: UpdateGroupConversationPayload,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update group settings (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Promotes an existing member to conversation admin (Admin only).
 */
export async function promoteMemberToAdmin(
  conversationId: string,
  targetUserId: string,
  token?: string
): Promise<ConversationItem> {
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations/${conversationId}/members/${targetUserId}/admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(token),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to promote member (HTTP ${res.status})`);
  }

  return res.json();
}

