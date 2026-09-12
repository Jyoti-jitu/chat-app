export type NotificationCategory = "all" | "messages" | "requests" | "system";

export interface NotificationItem {
  id: string;
  type: "reaction" | "request" | "mention" | "file" | "system";
  category: NotificationCategory;
  actor: {
    name: string;
    avatar?: string;
    username?: string;
  };
  title?: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}
