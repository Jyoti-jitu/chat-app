"use client";

import React from "react";
import { FileText, ArrowDownToLine } from "lucide-react";
import { MessageAttachment } from "@/types/message";

export function AttachmentCard({ attachment }: { attachment: MessageAttachment }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] max-w-xs shadow-xs my-1.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
            {attachment.name}
          </p>
          <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
            {attachment.size}
          </p>
        </div>
      </div>
      <button
        onClick={() => alert(`Downloading ${attachment.name}...`)}
        title="Download file"
        className="p-2 rounded-lg text-[#66736D] dark:text-[#8E9C95] hover:text-[#168F67] dark:hover:text-[#22A06B] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] transition-colors cursor-pointer"
      >
        <ArrowDownToLine className="w-4 h-4" />
      </button>
    </div>
  );
}
