export interface UserStats {
  chats: number;
  connections: number;
  groups: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
  bio?: string;
  mutualCount?: number;
  joinedDate?: string;
  stats?: UserStats;
}
