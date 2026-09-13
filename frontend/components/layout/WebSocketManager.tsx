"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  UserPlus,
  MessageSquare,
  UsersRound,
  X,
  ExternalLink,
} from "lucide-react";
import { wsClient } from "@/lib/api/websocket";
import { getStoredToken } from "@/lib/api/auth";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export interface LiveToastNotification {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  actor?: {
    name: string;
    username?: string;
    avatar?: string;
  };
  link?: string;
  timestamp: number;
}

export function WebSocketManager() {
  const router = useRouter();
  const [toasts, setToasts] = useState<LiveToastNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (notif: LiveToastNotification) => {
      setToasts((prev) => {
        // Prevent exact duplicates within 3 seconds
        if (prev.some((t) => t.id === notif.id)) return prev;
        return [notif, ...prev.slice(0, 2)]; // Keep max 3 toasts stacked
      });

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        dismissToast(notif.id);
      }, 6000);
    },
    [dismissToast]
  );

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      wsClient.connect(token);
    }

    // Re-connect on window focus/visibility change if disconnected
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentToken = getStoredToken();
        if (currentToken && !wsClient.isConnected()) {
          wsClient.connect(currentToken);
        }
      }
    };

    const handleNotificationNew = (payload: any) => {
      const data = payload?.data || payload;
      if (!data) return;

      const toastItem: LiveToastNotification = {
        id: data.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: data.type || "system",
        category: data.category || "requests",
        title: data.title || "New Notification",
        description: data.description || "You have a new alert in FluxChat.",
        actor: data.actor
          ? {
              name: data.actor.name || "FluxChat User",
              username: data.actor.username || undefined,
              avatar: data.actor.avatar || undefined,
            }
          : undefined,
        link: data.link || (data.type === "request" ? "/app/requests" : "/app/notifications"),
        timestamp: Date.now(),
      };

      addToast(toastItem);

      // Broadcast custom window event so other mounted views can increment badges or reload lists
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("fluxchat:notification_received", { detail: toastItem })
        );
      }
    };

    wsClient.on("notification.new", handleNotificationNew);

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      wsClient.off("notification.new", handleNotificationNew);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [addToast]);

  const renderIcon = (type: string) => {
    switch (type) {
      case "request":
        return <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "message":
        return <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "group":
        return <UsersRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-[var(--primary)]" />;
    }
  };

  return (
    <>
      {/* Toast Notification Container */}
      <div
        aria-live="assertive"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none w-full max-w-sm px-4 sm:px-0 sm:w-96 select-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl transition-all duration-300",
              "bg-white/95 dark:bg-[#16201C]/95 backdrop-blur-xl",
              "border border-[#E2E8E4] dark:border-[#273630]",
              "hover:shadow-2xl hover:border-[var(--primary)]/40",
              "animate-in fade-in slide-in-from-top-4 duration-300"
            )}
          >
            {/* Avatar or Icon Badge */}
            <div className="relative shrink-0 mt-0.5">
              {toast.actor?.name ? (
                <Avatar
                  src={toast.actor.avatar}
                  name={toast.actor.name}
                  size="md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  {renderIcon(toast.type)}
                </div>
              )}
              {toast.actor?.name && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-[#16201C] flex items-center justify-center shadow-xs border border-[#E2E8E4] dark:border-[#273630]">
                  {renderIcon(toast.type)}
                </span>
              )}
            </div>

            {/* Content Details */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <h4 className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                  {toast.title}
                </h4>
                <span className="text-[10px] text-[#85948D] dark:text-[#7D8F86] shrink-0 font-medium">
                  Just now
                </span>
              </div>
              <p className="text-xs text-[#52635B] dark:text-[#A1B3AB] leading-relaxed line-clamp-2">
                {toast.description}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2">
                {toast.link && (
                  <button
                    type="button"
                    onClick={() => {
                      dismissToast(toast.id);
                      router.push(toast.link!);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 active:scale-95 transition-all shadow-xs"
                  >
                    <span>{toast.type === "request" ? "View Request" : "View"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="px-2 py-1 rounded-lg text-xs font-medium text-[#66736D] dark:text-[#8E9C95] hover:bg-[#F2F5F3] dark:hover:bg-[#202D27] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              title="Close notification"
              className="shrink-0 p-1 text-[#85948D] hover:text-[#17211D] dark:hover:text-[#F1F5F3] rounded-md hover:bg-[#F2F5F3] dark:hover:bg-[#202D27] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
