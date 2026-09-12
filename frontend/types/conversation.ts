export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string;
  avatar?: string;
  members: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isPinned?: boolean;
  isOnline?: boolean;
  category?: "all" | "unread" | "groups" | "favorites";
  section?: "primary" | "general";
  otherUserId?: string;
}
