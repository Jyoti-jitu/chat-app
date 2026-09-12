"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#17211D]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-white dark:bg-[#151D1A] rounded-2xl border border-[#E6EBE8] dark:border-[#212E29] p-6 shadow-flux-lg z-10 animate-in fade-in zoom-in-95 duration-150",
          sizes[size],
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E6EBE8] dark:border-[#212E29]">
          <div>
            <h3 className="text-lg font-bold text-[#17211D] dark:text-[#F1F5F3]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#66736D] dark:text-[#8E9C95] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
