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
  phone?: string;
  avatar?: string;
  coverImage?: string;
  website?: string;
  isOnline: boolean;
  lastSeen?: string;
  bio?: string;
  mutualCount?: number;
  joinedDate?: string;
  stats?: UserStats;
}
