"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const settingsNavItems = [
    {
      label: "Account",
      href: "/app/settings/account",
      icon: <User className="w-4 h-4" />,
    },
    {
      label: "Privacy",
      href: "/app/settings/privacy",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      label: "Notifications",
      href: "/app/settings/notifications",
      icon: <Bell className="w-4 h-4" />,
    },
    {
      label: "Appearance",
      href: "/app/settings/appearance",
      icon: <Palette className="w-4 h-4" />,
    },
    {
      label: "Language",
      href: "#",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      label: "Help & Support",
      href: "#",
      icon: <HelpCircle className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row h-full w-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors">
      {/* Settings Sub-sidebar matching panel 10 */}
      <aside className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shrink-0 p-4 sm:p-6 transition-colors">
        <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3] mb-4 text-left">
          Settings
        </h1>
        <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
          {settingsNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/app/settings/appearance" && pathname === "/app/settings");

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
                )}
              >
                <span className={isActive ? "text-[var(--primary)]" : ""}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Settings Panel */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F7F9F8] dark:bg-[#101614]">
        <div className="max-w-2xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
