import React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation } from "@/types/conversation";
import { cn } from "@/lib/utils/cn";

export interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onDelete?: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isActive = false,
  onDelete,
}: ConversationItemProps) {
  return (
    <Link
      href={`/app/chats/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group select-none",
        isActive
          ? "bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)]"
          : "hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
      )}
    >
      {/* Avatar */}
      <Avatar
        name={conversation.name}
        src={conversation.avatar}
        size="md"
        isOnline={conversation.isOnline}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                "text-xs font-bold truncate",
                isActive
                  ? "text-[#168F67] dark:text-[#22A06B]"
                  : "text-[#17211D] dark:text-[#F1F5F3]"
              )}
            >
              {conversation.name}
            </span>
            {conversation.section === "general" && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                General
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(conversation.id);
                }}
                title="Delete conversation"
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95] font-medium">
              {conversation.lastMessageTime}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-xs truncate",
              conversation.unreadCount > 0
                ? "font-semibold text-[#17211D] dark:text-[#F1F5F3]"
                : "text-[#66736D] dark:text-[#8E9C95]"
            )}
          >
            {conversation.lastMessage}
          </p>

          {conversation.unreadCount > 0 && (
            <span className="ml-2 w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
