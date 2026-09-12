export interface StatusSlide {
  id: string;
  type: "text" | "image";
  content: string;
  caption?: string;
  backgroundColor?: string;
  fontStyle?: "modern" | "serif" | "mono" | "bold";
  createdAt: string;
}

export interface UserStatus {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userInitials: string;
  isMe?: boolean;
  slides: StatusSlide[];
  viewed: boolean;
  lastUpdated: string;
}
