"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  logout,
  getStoredToken,
  getContactRequests,
  getNotifications,
  wsClient,
} from "@/lib/api";
import {
  MessageSquare,
  Users,
  UsersRound,
  UserPlus,
  Bell,
  Settings,
  LogOut,
  CircleDot,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ name: string; username: string; avatar?: string } | null>(null);
  const [requestsCount, setRequestsCount] = useState<number>(0);
  const [notificationsCount, setNotificationsCount] = useState<number>(0);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const fetchBadgeCounts = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const [reqRes, notifRes] = await Promise.allSettled([
        getContactRequests(token),
        getNotifications("all", 1, 0, token),
      ]);

      if (reqRes.status === "fulfilled" && reqRes.value?.received) {
        const pending = reqRes.value.received.filter((r) => r.status === "pending").length;
        setRequestsCount(pending);
      }
      if (notifRes.status === "fulfilled" && typeof notifRes.value?.unread_count === "number") {
        setNotificationsCount(notifRes.value.unread_count);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const updateLocalProfile = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("fluxchat_user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.name) {
              setProfile(parsed);
            }
          } catch {}
        }
      }
    };
    updateLocalProfile();
    window.addEventListener("fluxchat:profile_updated", updateLocalProfile);
    window.addEventListener("storage", updateLocalProfile);
    return () => {
      window.removeEventListener("fluxchat:profile_updated", updateLocalProfile);
      window.removeEventListener("storage", updateLocalProfile);
    };
  }, []);

  useEffect(() => {
    fetchBadgeCounts();

    const handleNewNotification = (payload: any) => {
      const data = payload?.data || payload;
      if (data?.type === "request" || data?.category === "requests") {
        setRequestsCount((prev) => prev + 1);
      }
      setNotificationsCount((prev) => prev + 1);
      fetchBadgeCounts();
    };

    wsClient.on("notification.new", handleNewNotification);
    window.addEventListener("fluxchat:notification_received", fetchBadgeCounts);
    window.addEventListener("fluxchat:requests_updated", fetchBadgeCounts);

    return () => {
      wsClient.off("notification.new", handleNewNotification);
      window.removeEventListener("fluxchat:notification_received", fetchBadgeCounts);
      window.removeEventListener("fluxchat:requests_updated", fetchBadgeCounts);
    };
  }, [fetchBadgeCounts]);

  useEffect(() => {
    if (pathname === "/app/requests") {
      setRequestsCount(0);
    }
    if (pathname === "/app/notifications") {
      setNotificationsCount(0);
    }
  }, [pathname]);

  const navItems = [
    {
      label: "Chats",
      href: "/app/chats",
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      label: "Status",
      href: "/app/status",
      icon: <CircleDot className="w-5 h-5" />,
      dot: true,
    },
    {
      label: "Groups",
      href: "/app/groups",
      icon: <UsersRound className="w-5 h-5" />,
    },
    {
      label: "Contacts",
      href: "/app/contacts",
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "Requests",
      href: "/app/requests",
      icon: <UserPlus className="w-5 h-5" />,
      badge: requestsCount > 0 ? requestsCount : undefined,
    },
    {
      label: "Notifications",
      href: "/app/notifications",
      icon: <Bell className="w-5 h-5" />,
      badge: notificationsCount > 0 ? notificationsCount : undefined,
    },
    {
      label: "Settings",
      href: "/app/settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-60 h-screen bg-white dark:bg-[#151D1A] border-r border-[#E6EBE8] dark:border-[#212E29] shrink-0 select-none transition-colors">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center border-b border-[#E6EBE8] dark:border-[#212E29]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white shadow-xs group-hover:opacity-90 transition-opacity">
            <MessageSquare className="w-4 h-4 fill-white" />
          </div>
          <span className="font-bold text-lg text-[#17211D] dark:text-[#F1F5F3] tracking-tight">
            Flux<span className="text-[var(--primary)]">Chat</span>
          </span>
        </Link>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/chats" && pathname.startsWith(item.href)) ||
            (item.href === "/app/chats" && pathname.startsWith("/app/chats"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group",
                isActive
                  ? "bg-[var(--primary-light)] text-[var(--primary)]"
                  : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "transition-colors",
                    isActive
                      ? "text-[var(--primary)]"
                      : "text-[#66736D] dark:text-[#8E9C95] group-hover:text-[#17211D] dark:group-hover:text-[#F1F5F3]"
                  )}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.dot && (
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] ring-2 ring-white dark:ring-[#151D1A]" />
              )}
              {item.badge && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[#F4F6F5] text-[#66736D] dark:bg-[#212E29] dark:text-[#8E9C95]"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile at Bottom */}
      <div className="p-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors">
          <Link
            href="/app/profile"
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <Avatar
              src={profile?.avatar}
              name={profile?.name || "My Account"}
              size="md"
              isOnline={true}
            />
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                {profile?.name || "My Account"}
              </div>
              <div className="text-[11px] text-[#66736D] dark:text-[#8E9C95] truncate">
                {profile?.username ? `@${profile.username}` : "Online"}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-[#66736D] dark:text-[#8E9C95] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
