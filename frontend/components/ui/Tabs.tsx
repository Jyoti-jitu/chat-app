"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: "pills" | "underlined";
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "pills",
  className,
}: TabsProps) {
  if (variant === "underlined") {
    return (
      <div
        className={cn(
          "flex items-center gap-6 border-b border-[#E6EBE8] dark:border-[#212E29]",
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative cursor-pointer",
                isActive
                  ? "text-[var(--primary)]"
                  : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3]"
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
                    isActive
                      ? "bg-[var(--primary-light)] text-[var(--primary)] font-bold"
                      : "bg-[#F4F6F5] text-[#66736D] dark:bg-[#1D2723] dark:text-[#8E9C95]"
                  )}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto py-1", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
              isActive
                ? "bg-[var(--primary-light)] text-[var(--primary)] font-bold"
                : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723]"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[#E6EBE8] text-[#66736D] dark:bg-[#212E29] dark:text-[#8E9C95]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
