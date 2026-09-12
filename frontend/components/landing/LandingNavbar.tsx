"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#101614]/90 backdrop-blur-md border-b border-[#E6EBE8] dark:border-[#212E29] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#168F67] flex items-center justify-center text-white shadow-xs group-hover:bg-[#127A57] transition-colors">
            <MessageSquare className="w-4 h-4 fill-white" />
          </div>
          <span className="font-bold text-lg text-[#17211D] dark:text-[#F1F5F3] tracking-tight">
            Flux<span className="text-[#168F67]">Chat</span>
          </span>
        </Link>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="#features"
            className="text-sm font-medium text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors"
          >
            Product
          </Link>
          <Link
            href="#features"
            className="text-sm font-medium text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="#about"
            className="text-sm font-medium text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] transition-colors"
          >
            About
          </Link>
        </nav>

        {/* Right: Auth triggers */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
