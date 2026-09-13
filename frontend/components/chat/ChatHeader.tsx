"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Search, Phone, Video, MoreVertical, ShieldAlert, Trash2, User, Eraser, Shield, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";

export interface ChatHeaderProps {
  name: string;
  isOnline?: boolean;
  avatar?: string;
  isGroup?: boolean;
  pendingRequestsCount?: number;
  onOpenGroupSettings?: () => void;
  onSearch?: () => void;
  onClearMessages?: () => void;
  onDeleteConversation?: () => void;
}

export function ChatHeader({
  name,
  isOnline = true,
  avatar,
  isGroup = false,
  pendingRequestsCount = 0,
  onOpenGroupSettings,
  onSearch,
  onClearMessages,
  onDeleteConversation,
}: ChatHeaderProps) {
  const moreMenuItems = [
    ...(isGroup
      ? [
          {
            id: "group_settings",
            label: "Group Info & Settings",
            icon: <Shield className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />,
            onClick: () => onOpenGroupSettings?.(),
          },
        ]
      : [
          {
            id: "profile",
            label: "View contact info",
            icon: <User className="w-4 h-4" />,
            onClick: () => {},
          },
        ]),
    {
      id: "clear",
      label: "Clear chat history",
      icon: <Eraser className="w-4 h-4" />,
      danger: false,
      onClick: () => onClearMessages?.(),
    },
    ...(!isGroup
      ? [
          {
            id: "block",
            label: "Block contact",
            icon: <ShieldAlert className="w-4 h-4" />,
            onClick: () => alert(`Blocked ${name}`),
          },
        ]
      : []),
    {
      id: "delete",
      label: isGroup ? "Leave / Delete group" : "Delete conversation",
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => onDeleteConversation?.(),
    },
  ];

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shrink-0 transition-colors">
      <div
        className={`flex items-center gap-3 min-w-0 ${isGroup ? "cursor-pointer" : ""}`}
        onClick={isGroup ? onOpenGroupSettings : undefined}
      >
        {/* Back button for mobile navigation */}
        <Link
          href="/app/chats"
          onClick={(e) => e.stopPropagation()}
          className="sm:hidden p-1.5 -ml-1 text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* User / Group Avatar */}
        <Avatar name={name} src={avatar} size="md" isOnline={!isGroup && isOnline} />

        {/* Details */}
        <div className="min-w-0 text-left">
          <h2 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate flex items-center gap-1.5">
            <span>{name}</span>
            {isGroup && (
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-[#EAF5F0] dark:bg-[#1B2F25] text-[#168F67] dark:text-[#22A06B]">
                Group
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            {!isGroup ? (
              <>
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
              </>
            ) : (
              <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95] hover:underline">
                Tap for group settings
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 sm:gap-2 text-[#66736D] dark:text-[#8E9C95]">
        {isGroup && onOpenGroupSettings && (
          <button
            onClick={onOpenGroupSettings}
            title="Group settings"
            className="relative p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#151D1A]" />
            )}
          </button>
        )}

        <button
          onClick={onSearch}
          title="Search in conversation"
          className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
        </button>

        {!isGroup && (
          <>
            <button
              onClick={() => alert("Voice call service available in production")}
              title="Start voice call"
              className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => alert("Video call service available in production")}
              title="Start video call"
              className="p-2 rounded-xl hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors cursor-pointer hidden xs:flex"
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dropdown Options Menu */}
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
          align="right"
        />
      </div>
    </header>
  );
}
