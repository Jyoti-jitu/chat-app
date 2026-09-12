import { NotificationItem } from "@/types/notification";

export const mockNotifications: NotificationItem[] = [
  {
    id: "n1",
    type: "reaction",
    category: "messages",
    actor: {
      name: "Alex Johnson",
      username: "alexd",
    },
    description: "Reacted to your message",
    timestamp: "2m ago",
    isRead: false,
    link: "/app/chats/c1",
  },
  {
    id: "n2",
    type: "request",
    category: "requests",
    actor: {
      name: "Emma Davis",
      username: "emma",
    },
    description: "Sent you a friend request",
    timestamp: "15m ago",
    isRead: false,
    link: "/app/requests",
  },
  {
    id: "n3",
    type: "mention",
    category: "messages",
    actor: {
      name: "Design Team",
      username: "design",
    },
    description: "Mentioned you in a message",
    timestamp: "1h ago",
    isRead: false,
    link: "/app/chats/c2",
  },
  {
    id: "n4",
    type: "file",
    category: "messages",
    actor: {
      name: "Michael Chen",
      username: "michael",
    },
    description: "Shared a file with you",
    timestamp: "3h ago",
    isRead: true,
    link: "/app/chats/c1",
  },
  {
    id: "n5",
    type: "system",
    category: "system",
    actor: {
      name: "System",
      username: "system",
    },
    description: "Your password was changed",
    timestamp: "1d ago",
    isRead: true,
  },
];
