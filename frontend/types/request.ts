import { User } from "./user";

export interface ConnectionRequest {
  id: string;
  user: User;
  type: "received" | "sent";
  status: "pending" | "accepted" | "rejected";
  timestamp: string;
  mutualFriends?: number;
}
