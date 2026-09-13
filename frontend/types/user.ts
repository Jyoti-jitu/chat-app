export interface UserStats {
  chats: number;
  connections: number;
  groups: number;
}

export interface ProfileLink {
  title: string;
  url: string;
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
  links?: ProfileLink[];
  isOnline: boolean;
  lastSeen?: string;
  bio?: string;
  mutualCount?: number;
  joinedDate?: string;
  stats?: UserStats;
}
