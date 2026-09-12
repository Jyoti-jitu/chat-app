/**
 * Notification Service REST API client for FluxChat.
 * Interfaces with the FastAPI Notification Service running on port 8006.
 */
import { getStoredToken } from "./auth";
import type { ActionSuccessResponse } from "./contact";

export const NOTIFICATION_SERVICE_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL ||
  "http://localhost:8006/api/v1";

export interface ActorProfile {
  name: string;
  username?: string | null;
  avatar?: string | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  category: string;
  actor: ActorProfile;
  title?: string | null;
  description: string;
  reference_id?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at?: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}


/**
 * Retrieves notifications for the authenticated user.
 */
export async function getNotifications(
  category?: string,
  limit: number = 50,
  skip: number = 0,
  token?: string
): Promise<NotificationListResponse> {
  const authToken = token || getStoredToken();
  const catParam = category && category !== "all" ? `&category=${category}` : "";
  const res = await fetch(
    `${NOTIFICATION_SERVICE_URL}/notifications?limit=${limit}&skip=${skip}${catParam}`,
    {
      method: "GET",
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch notifications");
  }
  return data;
}

/**
 * Marks an individual notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(
    `${NOTIFICATION_SERVICE_URL}/notifications/${notificationId}/read`,
    {
      method: "POST",
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to mark notification as read");
  }
  return data;
}

/**
 * Marks all unread notifications as read.
 */
export async function markAllNotificationsAsRead(
  token?: string
): Promise<ActionSuccessResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(
    `${NOTIFICATION_SERVICE_URL}/notifications/read-all`,
    {
      method: "POST",
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to mark all notifications as read");
  }
  return data;
}

/**
 * Dismisses a single notification.
 */
export async function deleteNotification(
  notificationId: string,
  token?: string
): Promise<ActionSuccessResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(
    `${NOTIFICATION_SERVICE_URL}/notifications/${notificationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to delete notification");
  }
  return data;
}

/**
 * Clears all notifications for the authenticated user.
 */
export async function clearAllNotifications(
  token?: string
): Promise<ActionSuccessResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications`, {
    method: "DELETE",
    headers: {
      Authorization: authToken ? `Bearer ${authToken}` : "",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to clear notifications");
  }
  return data;
}
