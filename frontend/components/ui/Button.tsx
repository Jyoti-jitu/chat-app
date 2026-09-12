"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]";

    const variants = {
      primary:
        "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-sm font-semibold hover:shadow",
      secondary:
        "bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] border border-[#E6EBE8] dark:border-[#212E29] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] shadow-sm",
      outline:
        "bg-transparent border border-[#E6EBE8] dark:border-[#212E29] text-[#17211D] dark:text-[#F1F5F3] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]",
      ghost:
        "bg-transparent text-[#66736D] dark:text-[#8E9C95] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] hover:text-[#17211D] dark:hover:text-[#F1F5F3]",
      soft:
        "bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 font-semibold",
      danger:
        "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-6 py-2.5 gap-2.5 font-semibold",
      icon: "p-2 aspect-square",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
