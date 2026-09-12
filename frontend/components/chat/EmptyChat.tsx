"use client";

import React from "react";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmptyChat({ onNewChat }: { onNewChat?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FFFFFF] dark:bg-[#101614] select-none transition-colors">
      <div className="max-w-sm space-y-5">
        {/* Chat illustration matching panel 5 */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.15)] animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] shadow-flux flex items-center justify-center text-[#168F67] dark:text-[#22A06B]">
            <MessageSquarePlus className="w-8 h-8" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#168F67] text-white flex items-center justify-center text-[10px] shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
            Select a conversation
          </h2>
          <p className="text-xs text-[#66736D] dark:text-[#8E9C95] leading-relaxed">
            Choose a chat from the list or start a new one to connect with your team and friends.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <Button onClick={onNewChat} size="md">
            Start a new chat
          </Button>
        </div>
      </div>
    </div>
  );
}
