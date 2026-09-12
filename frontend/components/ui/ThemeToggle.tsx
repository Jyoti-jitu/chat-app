"use client";

import React, { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils/cn";

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

const emptySubscribe = () => () => {};

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return (
      <div
        className={cn(
          "w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/80 animate-pulse",
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={cn(
        "relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-200",
        "border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20",
        "bg-white/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80",
        "text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400",
        "shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer group",
        className
      )}
    >
      <div className="relative w-4 h-4">
        <Sun
          className={cn(
            "w-4 h-4 absolute inset-0 transition-all duration-300 transform",
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 text-amber-500"
          )}
        />
        <Moon
          className={cn(
            "w-4 h-4 absolute inset-0 transition-all duration-300 transform",
            isDark
              ? "rotate-0 scale-100 opacity-100 text-indigo-400"
              : "-rotate-90 scale-0 opacity-0"
          )}
        />
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-medium select-none">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}
