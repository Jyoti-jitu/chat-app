"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ROUTES } from "@/lib/constants/routes";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkHref?: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-indigo-600/10 dark:bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link
            href={ROUTES.HOME}
            className="inline-flex items-center gap-2.5 group transition-transform hover:scale-105"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">
              Nova<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
            </span>
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{subtitle}</p>
          </div>

          {children}

          {footerText && footerLinkText && footerLinkHref && (
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
              {footerText}{" "}
              <Link
                href={footerLinkHref}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
              >
                {footerLinkText}
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
