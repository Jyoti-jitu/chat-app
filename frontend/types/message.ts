export interface MessageAttachment {
  name: string;
  size: string;
  type: "file" | "image";
  url?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  type: "text" | "image" | "file";
  createdAt: string;
  status: "sent" | "delivered" | "read";
  attachment?: MessageAttachment;
  edited?: boolean;
  reactions?: MessageReaction[];
  replyTo?: string;
}
