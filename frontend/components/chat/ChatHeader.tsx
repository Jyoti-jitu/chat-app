"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Search, Phone, Video, MoreVertical, ShieldAlert, Trash2, User, Eraser } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";

export interface ChatHeaderProps {
  name: string;
  isOnline?: boolean;
  avatar?: string;
  onSearch?: () => void;
  onClearMessages?: () => void;
  onDeleteConversation?: () => void;
}

export function ChatHeader({
  name,
  isOnline = true,
  avatar,
  onSearch,
  onClearMessages,
  onDeleteConversation,
}: ChatHeaderProps) {
  const moreMenuItems = [
    {
      id: "profile",
      label: "View contact info",
      icon: <User className="w-4 h-4" />,
      onClick: () => {},
    },
    {
      id: "clear",
      label: "Clear chat history",
      icon: <Eraser className="w-4 h-4" />,
      danger: false,
      onClick: () => onClearMessages?.(),
    },
    {
      id: "block",
      label: "Block contact",
      icon: <ShieldAlert className="w-4 h-4" />,
      onClick: () => alert(`Blocked ${name}`),
    },
    {
      id: "delete",
      label: "Delete conversation",
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => onDeleteConversation?.(),
    },
  ];

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shrink-0 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button for mobile navigation */}
        <Link
          href="/app/chats"
          className="sm:hidden p-1.5 -ml-1 text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* User Avatar */}
        <Avatar name={name} src={avatar} size="md" isOnline={isOnline} />

        {/* User details */}
        <div className="min-w-0 text-left">
          <h2 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
            {name}
          </h2>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-[#22A06B]" : "bg-neutral-400 dark:bg-neutral-600"
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                isOnline
                  ? "text-[#22A06B]"
                  : "text-[#66736D] dark:text-[#8E9C95]"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 sm:gap-2 text-[#66736D] dark:text-[#8E9C95]">
        <button
          onClick={onSearch}
          title="Search in conversation"
          className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => alert(`Starting voice call with ${name}...`)}
          title="Voice call"
          className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          onClick={() => alert(`Starting video call with ${name}...`)}
          title="Video call"
          className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
        >
          <Video className="w-4 h-4" />
        </button>

        <Dropdown
          trigger={
            <button
              title="More options"
              className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          }
          items={moreMenuItems}
        />
      </div>
    </header>
  );
}
