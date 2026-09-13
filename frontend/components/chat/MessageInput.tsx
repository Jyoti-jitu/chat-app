"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Smile, Mic, Send, X, Edit3, Reply, Loader2, Image as ImageIcon, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface MessageInputProps {
  onSendMessage: (content: string, replyToId?: string) => Promise<void> | void;
  onSendAttachment?: (file: { name: string; size: string; type: "file" }) => void;
  onSendFile?: (file: File) => Promise<void> | void;
  isUploadingAttachment?: boolean;
  onTyping?: (isTyping: boolean) => void;
  replyingTo?: { id: string; senderName: string; content: string } | null;
  onCancelReply?: () => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string, newContent: string) => Promise<void> | void;
  disabled?: boolean;
}

export function MessageInput({
  onSendMessage,
  onSendAttachment,
  onSendFile,
  isUploadingAttachment = false,
  onTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sampleEmojis = ["🙂", "❤️", "👍", "🚀", "🎉", "🔥", "✨", "👏", "🙌", "😍", "🥳", "💯"];

  // Populate input when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    // Emit typing indicator
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending || disabled) return;

    try {
      setIsSending(true);
      if (onTyping) onTyping(false);

      if (editingMessage && onSaveEdit) {
        await onSaveEdit(editingMessage.id, content.trim());
      } else {
        await onSendMessage(content.trim(), replyingTo ? replyingTo.id : undefined);
      }
      setContent("");
      setShowEmojiPicker(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onSendFile) {
      onSendFile(file);
    } else {
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
      onSendAttachment?.({
        name: file.name,
        size: formatBytes(file.size),
        type: "file",
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  return (
    <div className="relative bg-white dark:bg-[#151D1A] border-t border-[#E6EBE8] dark:border-[#212E29]">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Uploading Progress Banner */}
      {isUploadingAttachment && (
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">Uploading media to Cloudinary...</span>
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-[#F4F6F5] dark:bg-[#1A2622] border-b border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-3.5 h-3.5 text-[#168F67] dark:text-[#22A06B] shrink-0" />
            <span className="truncate text-[#66736D] dark:text-[#8E9C95]">
              Replying to <strong className="text-[#17211D] dark:text-[#F1F5F3]">{replyingTo.senderName}</strong>:{" "}
              {replyingTo.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-[#66736D] hover:text-[#17211D] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 min-w-0 text-amber-800 dark:text-amber-300">
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold truncate">Editing message</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setContent("");
              onCancelEdit?.();
            }}
            className="p-1 rounded-full text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 p-3 bg-white dark:bg-[#1A2622] rounded-2xl shadow-xl border border-[#E6EBE8] dark:border-[#212E29] flex flex-wrap gap-2 z-20 max-w-xs animate-in zoom-in-95 duration-100">
          {sampleEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="text-xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-[#F4F6F5] dark:hover:bg-[#151D1A] cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Row */}
      <div className="p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Photos Button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || Boolean(editingMessage) || isUploadingAttachment}
            title="Attach photo"
            className="p-2.5 rounded-full bg-[#F4F6F5] dark:bg-[#1D2723] text-[#66736D] dark:text-[#8E9C95] hover:text-[#168F67] dark:hover:text-[#22A06B] hover:bg-[#EAF5F0] dark:hover:bg-[#24332D] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Documents / Files Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || Boolean(editingMessage) || isUploadingAttachment}
            title="Attach file"
            className="p-2.5 rounded-full bg-[#F4F6F5] dark:bg-[#1D2723] text-[#66736D] dark:text-[#8E9C95] hover:text-[#168F67] dark:hover:text-[#22A06B] hover:bg-[#EAF5F0] dark:hover:bg-[#24332D] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Input box */}
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              placeholder={editingMessage ? "Update message..." : "Type a message..."}
              value={content}
              onChange={handleInputChange}
              disabled={disabled || isSending}
              className={cn(
                "w-full rounded-2xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-transparent px-4 py-2.5 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D]",
                "focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67]/50 focus:ring-2 focus:ring-[#168F67]/15",
                "transition-all duration-150 pr-20 disabled:opacity-60"
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

          {/* Green Send / Save Button */}
          <button
            type="submit"
            disabled={!content.trim() || isSending || disabled || isUploadingAttachment}
            title={editingMessage ? "Save edit" : "Send message"}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm",
              content.trim() && !isSending && !isUploadingAttachment
                ? "bg-[#168F67] hover:bg-[#127A57] text-white scale-100"
                : "bg-[#E6EBE8] dark:bg-[#212E29] text-[#9BA7A1] dark:text-[#66736D] cursor-not-allowed"
            )}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : editingMessage ? (
              <Edit3 className="w-4 h-4 text-white" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
