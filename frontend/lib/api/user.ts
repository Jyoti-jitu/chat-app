/**
 * User Service REST API client for FluxChat.
 * Interfaces with the FastAPI User Service running on port 8002.
 */

export const USER_SERVICE_URL =
  process.env.NEXT_PUBLIC_USER_SERVICE_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : "http://localhost:8002/api/v1");

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  is_active: boolean;
  is_online: boolean;
  last_seen?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserPublicProfile {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  bio?: string | null;
  phone?: string | null;
  is_online: boolean;
  last_seen?: string | null;
}

export interface UserSearchResponse {
  items: UserPublicProfile[];
  total: number;
  query: string;
}

export interface UpdateProfilePayload {
  name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
}

import { getStoredToken } from "./auth";

/**
 * Retrieves authenticated user's private profile from User Service.
 */
export async function getMyProfile(token?: string): Promise<UserProfile> {
  const authToken = token || getStoredToken();

  const res = await fetch(`${USER_SERVICE_URL}/users/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch profile (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Updates authenticated user's profile details.
 */
export async function updateMyProfile(
  payload: UpdateProfilePayload,
  token?: string
): Promise<UserProfile> {
  const authToken = token || getStoredToken();

  const res = await fetch(`${USER_SERVICE_URL}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update profile (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Searches users across the platform by username, name, email, or phone.
 * If query is empty, returns all registered users on the platform.
 */
export async function searchUsers(
  query: string = "",
  limit: number = 50,
  token?: string
): Promise<UserSearchResponse> {
  const authToken = token || getStoredToken();

  const queryString = query ? `?q=${encodeURIComponent(query)}&limit=${limit}` : `?limit=${limit}`;
  const res = await fetch(
    `${USER_SERVICE_URL}/users/search${queryString}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to search users (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retrieves public profile for a specific user.
 */
export async function getUserPublicProfile(
  userId: string,
  token?: string
): Promise<UserPublicProfile> {
  const authToken = token || getStoredToken();

  const res = await fetch(`${USER_SERVICE_URL}/users/${userId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch public profile (HTTP ${res.status})`);
  }

  return res.json();
}
