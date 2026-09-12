/**
 * Contacts and Connection Requests REST API client for FluxChat.
 * Interfaces with the FastAPI User Service running on port 8002.
 */
import { USER_SERVICE_URL, UserPublicProfile } from "./user";

export interface ContactItem {
  id: string;
  contact_id: string;
  user: UserPublicProfile;
  created_at?: string | null;
}

export interface ContactListResponse {
  items: ContactItem[];
  total: number;
}

export interface ContactRequestItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  sender?: UserPublicProfile | null;
  recipient?: UserPublicProfile | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ContactRequestListResponse {
  received: ContactRequestItem[];
  sent: ContactRequestItem[];
}

export interface SendContactRequestPayload {
  recipient_id?: string;
  identifier?: string;
}

export interface ActionSuccessResponse {
  status: string;
  message: string;
}

import { getStoredToken } from "./auth";

function getAuthHeader(token?: string): Record<string, string> {
  const authToken = token || getStoredToken();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/**
 * Retrieves confirmed contact roster for the authenticated user.
 */
export async function getContacts(token?: string): Promise<ContactListResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch contacts (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Removes a contact relationship from the roster (bidirectional).
 */
export async function deleteContact(
  contactId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/${contactId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to remove contact (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Sends a connection request by username, email, phone, or recipient user ID.
 */
export async function sendContactRequest(
  payload: SendContactRequestPayload,
  token?: string
): Promise<ContactRequestItem> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/requests`, {
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
      errorData.detail || `Failed to send connection request (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Lists all pending sent and received connection requests.
 */
export async function getContactRequests(
  token?: string
): Promise<ContactRequestListResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/requests`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch connection requests (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Accepts a received connection request.
 */
export async function acceptContactRequest(
  requestId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/requests/${requestId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to accept connection request (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Rejects a received connection request.
 */
export async function rejectContactRequest(
  requestId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/requests/${requestId}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to reject connection request (HTTP ${res.status})`
    );
  }

  return res.json();
}

/**
 * Cancels a sent connection request.
 */
export async function cancelContactRequest(
  requestId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const res = await fetch(`${USER_SERVICE_URL}/contacts/requests/${requestId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(token),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to cancel connection request (HTTP ${res.status})`
    );
  }

  return res.json();
}
