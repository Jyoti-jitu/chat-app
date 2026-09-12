import { User } from "./user";

export type MessageType = "text" | "image" | "file" | "system";
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  content: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  isGroup: boolean;
  avatarUrl?: string;
  lastMessage?: Message;
  unreadCount: number;
  participants: User[];
  createdAt: string;
  updatedAt: string;
}
