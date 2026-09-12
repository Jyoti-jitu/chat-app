"use client";

import React from "react";
import {
  Search,
  SquarePen,
  MessageSquare,
  Users,
  Bell,
  User as UserIcon,
  Wifi,
  Battery,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export function HeroChatPreview() {
  return (
    <div className="relative flex items-center justify-center py-6 select-none">
      {/* Soft green ambient glow */}
      <div className="absolute w-[360px] h-[360px] bg-[#168F67]/10 dark:bg-[#22A06B]/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Decorative leaf / plant accent behind */}
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-emerald-100/60 dark:bg-emerald-950/30 rounded-full blur-2xl pointer-events-none" />

      {/* Floating Note Badge */}
      <div className="absolute -right-2 sm:right-4 top-20 z-20 transform rotate-3 bg-white dark:bg-[#1A2622] rounded-2xl p-4 shadow-flux-lg border border-[#E6EBE8] dark:border-[#212E29] max-w-[190px] animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#168F67] dark:text-[#22A06B] mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Daily Note</span>
        </div>
        <p className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] leading-snug">
          Good conversations create better days ✨
        </p>
      </div>

      {/* CSS Smartphone Mockup */}
      <div className="relative z-10 w-[290px] sm:w-[320px] h-[580px] bg-white dark:bg-[#151D1A] rounded-[44px] p-3 shadow-2xl border-[7px] border-[#17211D] dark:border-[#2F3F38] flex flex-col overflow-hidden">
        {/* Phone Dynamic Island / Speaker */}
        <div className="pt-2 px-6 pb-2 flex items-center justify-between text-[11px] font-semibold text-[#17211D] dark:text-[#F1F5F3]">
          <span>9:41</span>
          <div className="w-20 h-4 bg-[#17211D] dark:bg-[#2F3F38] rounded-full mx-auto" />
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* In-app Header */}
        <div className="px-3 pt-2 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#17211D] dark:text-[#F1F5F3]">
            FluxChat
          </h2>
          <button className="p-1.5 rounded-full hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B]">
            <SquarePen className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2.5">
          <div className="flex items-center gap-2 bg-[#F4F6F5] dark:bg-[#1D2723] rounded-xl px-3 py-1.5 text-xs text-[#66736D] dark:text-[#8E9C95]">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Search</span>
          </div>
        </div>

        {/* Mobile Chat List Items */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {[
            {
              name: "Alex Johnson",
              message: "Hey! Are you free today?",
              time: "9:41",
              online: true,
              unread: 0,
            },
            {
              name: "Design Team",
              message: "Let's review the design file",
              time: "9:20",
              online: true,
              unread: 2,
            },
            {
              name: "Sophia Lee",
              message: "Sent a photo",
              time: "8:45",
              online: true,
              unread: 0,
            },
            {
              name: "Family",
              message: "Mom: Dinner at 7?",
              time: "Yesterday",
              online: false,
              unread: 0,
            },
            {
              name: "Michael Chen",
              message: "Typing...",
              time: "Mon",
              online: true,
              unread: 0,
              isTyping: true,
            },
            {
              name: "Product Squad",
              message: "Nice work!",
              time: "Mon",
              online: true,
              unread: 0,
            },
          ].map((chat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors"
            >
              <Avatar name={chat.name} size="sm" isOnline={chat.online} />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] truncate">
                    {chat.name}
                  </span>
                  <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                    {chat.time}
                  </span>
                </div>
                <p
                  className={`text-[11px] truncate mt-0.5 ${
                    chat.isTyping
                      ? "text-[#168F67] dark:text-[#22A06B] font-medium italic"
                      : "text-[#66736D] dark:text-[#8E9C95]"
                  }`}
                >
                  {chat.message}
                </p>
              </div>
              {chat.unread > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#168F67] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                  {chat.unread}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Mobile App Bottom Bar */}
        <div className="pt-2 pb-1 border-t border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-around text-[10px]">
          <div className="flex flex-col items-center gap-0.5 text-[#168F67] dark:text-[#22A06B] font-semibold">
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>Chats</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-[#66736D] dark:text-[#8E9C95]">
            <Users className="w-4 h-4" />
            <span>Contacts</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-[#66736D] dark:text-[#8E9C95]">
            <Bell className="w-4 h-4" />
            <span>Alerts</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-[#66736D] dark:text-[#8E9C95]">
            <UserIcon className="w-4 h-4" />
            <span>Profile</span>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="w-24 h-1 bg-[#17211D]/30 dark:bg-[#F1F5F3]/30 rounded-full mx-auto mt-1" />
      </div>
    </div>
  );
}
