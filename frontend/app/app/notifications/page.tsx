"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  UserPlus,
  Smile,
  FileText,
  ShieldCheck,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NotificationItem, NotificationCategory } from "@/types/notification";
import { getStoredToken } from "@/lib/api/auth";
import { cn } from "@/lib/utils/cn";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  wsClient,
} from "@/lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchLiveNotifications = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setNotifications([]);
      return;
    }

    try {
      const res = await getNotifications(activeTab, 50, 0, token);
      const mapped: NotificationItem[] = (res.items || []).map((item) => ({
        id: item.id,
        type: (item.type as any) || "system",
        category: (item.category as any) || "messages",
        actor: {
          name: item.actor.name,
          username: item.actor.username || undefined,
          avatar: item.actor.avatar || undefined,
        },
        title: item.title || undefined,
        description: item.description,
        timestamp: item.created_at
          ? new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Just now",
        isRead: item.is_read,
        link: item.link || undefined,
      }));
      setNotifications(mapped);
    } catch (err: any) {
      console.warn("Could not load notifications:", err.message);
      setNotifications([]);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchLiveNotifications();

    const handleNewNotification = (payload: any) => {
      const data = payload.data || payload;
      setNotifications((prev) => [
        {
          id: data.id || `notif_${Date.now()}`,
          type: data.type || "system",
          category: data.category || "messages",
          actor: {
            name: data.actor?.name || "System",
            username: data.actor?.username,
            avatar: data.actor?.avatar,
          },
          title: data.title,
          description: data.description || "",
          timestamp: "Just now",
          isRead: false,
          link: data.link,
        },
        ...prev,
      ]);
    };

    wsClient.on("notification.new", handleNewNotification);
    return () => {
      wsClient.off("notification.new", handleNewNotification);
    };
  }, [fetchLiveNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const tabs = [
    { id: "all", label: "All", count: unreadCount },
    { id: "messages", label: "Messages" },
    { id: "requests", label: "Requests" },
    { id: "system", label: "System" },
  ];

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setToastMessage("All notifications marked as read");
    setTimeout(() => setToastMessage(""), 2000);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("fluxchat_access_token") || localStorage.getItem("accessToken")
        : null;
    if (token) {
      markAllNotificationsAsRead(token).catch(console.warn);
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setToastMessage("Notification dismissed");
    setTimeout(() => setToastMessage(""), 2000);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("fluxchat_access_token") || localStorage.getItem("accessToken")
        : null;
    if (token && !id.startsWith("n1") && !id.startsWith("n2") && !id.startsWith("n3")) {
      deleteNotification(id, token).catch(console.warn);
    }
  };

  const handleConfirmClearAll = async () => {
    setNotifications([]);
    setIsClearAllModalOpen(false);
    setToastMessage("All notifications cleared");
    setTimeout(() => setToastMessage(""), 2000);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("fluxchat_access_token") || localStorage.getItem("accessToken")
        : null;
    if (token) {
      clearAllNotifications(token).catch(console.warn);
    }
  };


  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true;
    return n.category === activeTab;
  });

  const getIconForType = (type: NotificationItem["type"]) => {
    switch (type) {
      case "reaction":
        return <Smile className="w-4 h-4 text-pink-500" />;
      case "request":
        return <UserPlus className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />;
      case "mention":
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case "file":
        return <FileText className="w-4 h-4 text-cyan-500" />;
      case "system":
        return <ShieldCheck className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 right-6 z-40 p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold flex items-center gap-2 shadow-flux-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header matching panel 9 */}
      <div className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29]">
        <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Notifications
        </h1>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full flex-1 overflow-y-auto space-y-6">
        {/* Filter Pills matching panel 9 */}
        <div>
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as NotificationCategory)}
            variant="pills"
          />
        </div>

        {/* Notifications List matching panel 9 */}
        <div className="space-y-2.5">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => {
              const content = (
                <div
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                    !notif.isRead
                      ? "bg-white dark:bg-[#151D1A] border-[#CFD6D2] dark:border-[#2F3F38] shadow-xs"
                      : "bg-[#F7F9F8] dark:bg-[#131A17] border-[#E6EBE8] dark:border-[#212E29]"
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar name={notif.actor.name} size="md" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-[#151D1A] shadow-xs flex items-center justify-center">
                        {getIconForType(notif.type)}
                      </div>
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                        {notif.actor.name}
                      </p>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                        {notif.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      title="Delete notification"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                      {notif.timestamp}
                    </span>
                    {!notif.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#168F67] dark:bg-[#22A06B] shadow-xs" />
                    )}
                  </div>
                </div>
              );

              return notif.link ? (
                <Link key={notif.id} href={notif.link} className="block">
                  {content}
                </Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })
          ) : (
            <div className="text-center py-16 text-xs text-[#66736D] dark:text-[#8E9C95]">
              No notifications in this category.
            </div>
          )}
        </div>
      </div>

      {/* Clear All Notifications Modal */}
      <Modal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        title="Clear All Notifications"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Clear all notifications?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                This will permanently remove all notifications from your list. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setIsClearAllModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmClearAll}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

