import { ConnectionRequest } from "@/types/request";
import { mockUsers } from "./users";

export const mockRequests: ConnectionRequest[] = [
  {
    id: "r1",
    user: mockUsers[4], // Emma Davis
    type: "received",
    status: "pending",
    timestamp: "15m ago",
    mutualFriends: 5,
  },
  {
    id: "r2",
    user: mockUsers[2], // Sophia Lee
    type: "received",
    status: "pending",
    timestamp: "2h ago",
    mutualFriends: 12,
  },
  {
    id: "r3",
    user: mockUsers[5], // Daniel Garcia
    type: "sent",
    status: "pending",
    timestamp: "Yesterday",
    mutualFriends: 2,
  },
];
