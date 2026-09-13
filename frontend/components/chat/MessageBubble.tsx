"use client";

import React, { useState } from "react";
import { CheckCheck, Check, MoreVertical, Copy, Trash2, Reply, Smile, Edit3 } from "lucide-react";
import { Message } from "@/types/message";
import { AttachmentCard } from "./AttachmentCard";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils/cn";

export interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  repliedMessage?: Message;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
}

export function MessageBubble({
  message,
  isMe,
  repliedMessage,
  onDelete,
  onReact,
  onReply,
  onEdit,
}: MessageBubbleProps) {
  const [reactionList, setReactionList] = useState(message.reactions || []);

  const handleAddReaction = (emoji: string) => {
    setReactionList((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        return prev.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1 } : r
        );
      }
      return [...prev, { emoji, count: 1, users: ["me"] }];
    });
    onReact?.(message.id, emoji);
  };

  const menuItems = [
    {
      id: "reply",
      label: "Reply",
      icon: <Reply className="w-3.5 h-3.5" />,
      onClick: () => onReply?.(message),
    },
    {
      id: "react",
      label: "React ❤️",
      icon: <Smile className="w-3.5 h-3.5" />,
      onClick: () => handleAddReaction("❤️"),
    },
    {
      id: "copy",
      label: "Copy text",
      icon: <Copy className="w-3.5 h-3.5" />,
      onClick: () => navigator.clipboard.writeText(message.content),
    },
    ...(isMe
      ? [
          {
            id: "edit",
            label: "Edit",
            icon: <Edit3 className="w-3.5 h-3.5" />,
            onClick: () => onEdit?.(message),
          },
        ]
      : []),
    {
      id: "delete",
      label: isMe ? "Delete for everyone" : "Remove for me",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      danger: true,
      onClick: () => onDelete?.(message.id),
    },
  ];

  return (
    <div
      className={cn(
        "group relative flex flex-col my-1.5",
        isMe ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[82%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm transition-all",
          isMe
            ? "bg-[#DDF2E8] dark:bg-[#17382B] text-[#17211D] dark:text-[#F1F5F3] rounded-tr-xs"
            : "bg-[#F4F6F5] dark:bg-[#1B2622] text-[#17211D] dark:text-[#F1F5F3] rounded-tl-xs"
        )}
      >
        {/* Action menu trigger button on hover */}
        <div
          className={cn(
            "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity",
            isMe ? "-left-8" : "-right-8"
          )}
        >
          <Dropdown
            trigger={
              <button className="p-1 rounded-full bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] shadow-xs cursor-pointer">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            }
            items={menuItems}
            align={isMe ? "right" : "left"}
          />
        </div>

        {/* Replied message quote banner if present */}
        {repliedMessage && (
          <div className="mb-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 border-l-3 border-[#168F67] dark:border-[#22A06B] text-xs max-w-full">
            <span className="font-bold text-[10px] text-[#168F67] dark:text-[#22A06B] block mb-0.5">
              {repliedMessage.senderId === message.senderId ? "You" : "Replied Message"}
            </span>
            <p className="truncate text-xs opacity-75">{repliedMessage.content}</p>
          </div>
        )}

        {/* Message text content */}
        {message.content && (
          <p className="leading-relaxed whitespace-pre-wrap select-text">
            {message.content}
          </p>
        )}

        {/* File attachment if present */}
        {message.attachment && (
          <div className="mt-2">
            <AttachmentCard attachment={message.attachment} />
          </div>
        )}

        {/* Timestamp, Edited Tag, and Delivery Status Tick */}
        <div
          className={cn(
            "flex items-center gap-1.5 mt-1 text-[10px]",
            isMe
              ? "justify-end text-[#168F67] dark:text-[#22A06B]"
              : "justify-start text-[#66736D] dark:text-[#8E9C95]"
          )}
        >
          <span>{message.createdAt}</span>
          {message.edited && (
            <span className="opacity-70 text-[9px] italic">(edited)</span>
          )}
          {isMe && (
            <span>
              {message.status === "read" ? (
                <CheckCheck className="w-3.5 h-3.5 text-[#168F67] dark:text-[#22A06B]" />
              ) : (
                <Check className="w-3 h-3 text-[#66736D]" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Emoji Reactions below bubble */}
      {reactionList.length > 0 && (
        <div className="flex items-center gap-1 mt-1 px-1">
          {reactionList.map((reaction, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] text-xs shadow-xs"
            >
              <span>{reaction.emoji}</span>
              <span className="text-[10px] font-bold text-[#66736D] dark:text-[#8E9C95]">
                {reaction.count}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
