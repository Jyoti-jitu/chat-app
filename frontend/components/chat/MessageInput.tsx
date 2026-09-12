"use client";

import React, { useState, useRef } from "react";
import { Plus, Smile, Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onSendAttachment?: (file: { name: string; size: string; type: "file" }) => void;
}

export function MessageInput({
  onSendMessage,
  onSendAttachment,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleEmojis = ["🙂", "❤️", "👍", "🚀", "🎉", "🔥", "✨", "👏"];

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;
    onSendMessage(content.trim());
    setContent("");
    setShowEmojiPicker(false);
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleMockAttachment = () => {
    onSendAttachment?.({
      name: "Project_Specs_2026.pdf",
      size: "1.8 MB",
      type: "file",
    });
  };

  return (
    <div className="relative p-3 sm:p-4 bg-white dark:bg-[#151D1A] border-t border-[#E6EBE8] dark:border-[#212E29]">
      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 right-16 p-2 bg-white dark:bg-[#1A2622] rounded-2xl border border-[#E6EBE8] dark:border-[#212E29] shadow-flux-md flex items-center gap-1 z-30 animate-in fade-in zoom-in-95 duration-100">
          {sampleEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#F4F6F5] dark:hover:bg-[#24332D] rounded-xl transition-colors cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2">
        {/* Attachment button (+) */}
        <button
          type="button"
          onClick={handleMockAttachment}
          title="Add attachment"
          className="p-2.5 rounded-full bg-[#F4F6F5] dark:bg-[#1D2723] text-[#66736D] dark:text-[#8E9C95] hover:text-[#168F67] dark:hover:text-[#22A06B] hover:bg-[#EAF5F0] dark:hover:bg-[#24332D] transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Input box */}
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={cn(
              "w-full rounded-2xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-transparent px-4 py-2.5 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D]",
              "focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67]/50 focus:ring-2 focus:ring-[#168F67]/15",
              "transition-all duration-150 pr-20"
            )}
          />

          {/* Inline icons: Emoji + Mic */}
          <div className="absolute right-2.5 flex items-center gap-1 text-[#66736D] dark:text-[#8E9C95]">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
              className="p-1.5 rounded-lg hover:text-[#17211D] dark:hover:text-white cursor-pointer"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => alert("Voice messaging enabled in production")}
              title="Voice recording"
              className="p-1.5 rounded-lg hover:text-[#17211D] dark:hover:text-white cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Green Send Button */}
        <button
          type="submit"
          disabled={!content.trim()}
          title="Send message"
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm",
            content.trim()
              ? "bg-[#168F67] hover:bg-[#127A57] text-white scale-100"
              : "bg-[#E6EBE8] dark:bg-[#212E29] text-[#9BA7A1] dark:text-[#66736D] cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  );
}
