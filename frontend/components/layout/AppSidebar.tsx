"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { currentUser } from "@/lib/mock/users";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Chats",
      href: "/app/chats",
      icon: <MessageSquare className="w-5 h-5" />,
      badge: 3,
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
      badge: 4,
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
      badge: 2,
    },
    {
      label: "Notifications",
      href: "/app/notifications",
      icon: <Bell className="w-5 h-5" />,
      badge: 3,
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

      {/* User Profile at Bottom (matching reference) */}
      <div className="p-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors">
          <Link
            href="/app/profile"
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <Avatar
              name={currentUser.name}
              size="md"
              isOnline={currentUser.isOnline}
            />
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-[#66736D] dark:text-[#8E9C95] truncate">
                @{currentUser.username}
              </div>
            </div>
          </Link>
          <Link
            href="/login"
            title="Sign out"
            className="p-1.5 text-[#66736D] dark:text-[#8E9C95] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
