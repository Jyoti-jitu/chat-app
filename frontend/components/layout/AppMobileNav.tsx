"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, UsersRound, CircleDot, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function AppMobileNav() {
  const pathname = usePathname();

  const mobileNavItems = [
    {
      label: "Chats",
      href: "/app/chats",
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      label: "Status",
      href: "/app/status",
      icon: <CircleDot className="w-5 h-5" />,
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
      label: "Profile",
      href: "/app/profile",
      icon: <UserIcon className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#151D1A]/95 backdrop-blur-md border-t border-[#E6EBE8] dark:border-[#212E29] px-2 py-2 flex items-center justify-around transition-colors">
      {mobileNavItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/app/chats" && pathname.startsWith(item.href)) ||
          (item.href === "/app/chats" && pathname.startsWith("/app/chats"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors",
              isActive
                ? "text-[var(--primary)] font-bold"
                : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3]"
            )}
          >
            <span className={isActive ? "fill-current" : ""}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
