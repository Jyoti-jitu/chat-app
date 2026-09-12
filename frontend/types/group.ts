export interface GroupMember {
  id: string;
  name: string;
  role: "admin" | "member";
  avatar?: string;
  isOnline: boolean;
}

export interface Group {
  id: string;
  conversationId?: string;
  name: string;
  description: string;
  category: "work" | "social" | "family" | "tech" | "general";
  avatarEmoji?: string;
  avatarColor?: string;
  isPrivate: boolean;
  createdBy: string;
  isJoined: boolean;
  memberCount: number;
  onlineCount: number;
  members: GroupMember[];
  lastActivity: string;
  lastMessage?: string;
  unreadCount?: number;
}
