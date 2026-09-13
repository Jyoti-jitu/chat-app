import { getStoredToken } from "./auth";
import { UserStatus, StatusSlide } from "@/types/status";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CreateStatusPayload {
  type: "image" | "text";
  content: string;
  caption?: string;
  background_color?: string;
  font_style?: "modern" | "serif" | "mono" | "bold";
}

export interface StatusFeedResponse {
  items: UserStatus[];
  total: number;
}

/**
 * Posts a new 24h status slide (photo or text).
 */
export async function createStatusSlide(
  payload: CreateStatusPayload,
  token?: string
): Promise<StatusSlide> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_URL}/api/v1/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to post status.");
  }

  const data = await res.json();
  return {
    id: data.id,
    type: data.type,
    content: data.content,
    caption: data.caption,
    backgroundColor: data.background_color,
    fontStyle: data.font_style,
    createdAt: data.created_at,
  };
}

/**
 * Fetches the active status feed visible to the user (the user + connected contacts).
 */
export async function getActiveStatuses(token?: string): Promise<UserStatus[]> {
  const authToken = token || getStoredToken();
  if (!authToken) return [];

  const res = await fetch(`${API_URL}/api/v1/status`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const items = data.items || [];

  // Map to frontend UserStatus model
  return items.map((u: any) => ({
    id: u.id,
    userId: u.user_id,
    userName: u.user_name,
    userAvatar: u.user_avatar,
    userInitials: u.user_initials,
    isMe: u.is_me,
    viewed: u.viewed,
    lastUpdated: u.last_updated,
    slides: (u.slides || []).map((s: any) => ({
      id: s.id,
      type: s.type,
      content: s.content,
      caption: s.caption,
      backgroundColor: s.background_color,
      fontStyle: s.font_style,
      createdAt: s.created_at,
    })),
  }));
}

/**
 * Deletes an individual status slide.
 */
export async function deleteStatusSlide(slideId: string, token?: string): Promise<void> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_URL}/api/v1/status/${slideId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete slide.");
  }
}

/**
 * Deletes all status slides belonging to the authenticated user.
 */
export async function deleteMyStatus(token?: string): Promise<void> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${API_URL}/api/v1/status`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete status.");
  }
}
