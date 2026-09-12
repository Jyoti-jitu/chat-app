import React from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppMobileNav } from "@/components/layout/AppMobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[#FFFFFF] dark:bg-[#101614] text-[#17211D] dark:text-[#F1F5F3] overflow-hidden">
      {/* Desktop Left Sidebar */}
      <AppSidebar />

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden pb-14 sm:pb-0">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <AppMobileNav />
    </div>
  );
}
