"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, Star } from "lucide-react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroChatPreview } from "@/components/landing/HeroChatPreview";
import { FeatureStrip } from "@/components/landing/FeatureStrip";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const featuredMembers = [
  { name: "Alex Rivera" },
  { name: "Sarah Chen" },
  { name: "Marcus Johnson" },
  { name: "Elena Gomez" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#101614] text-[#17211D] dark:text-[#F1F5F3] transition-colors">
      {/* Top Navbar */}
      <LandingNavbar />

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Content */}
          <div className="lg:col-span-6 text-left space-y-6">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] border border-[#168F67]/20 text-xs font-semibold text-[#168F67] dark:text-[#22A06B]">
              <span>A simple, secure and beautiful way to connect</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#17211D] dark:text-white tracking-tight leading-[1.15]">
              Conversations <br />
              for a{" "}
              <span className="text-[#168F67] dark:text-[#22A06B]">
                brighter tomorrow
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#66736D] dark:text-[#8E9C95] max-w-lg leading-relaxed">
              Chat, share, plan and stay connected with the people who matter most — anywhere, anytime. Designed for effortless clarity.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/register">
                <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Get Started
                </Button>
              </Link>
              <Link href="/app/chats">
                <Button
                  variant="secondary"
                  size="lg"
                  leftIcon={<Play className="w-4 h-4 fill-current text-[#168F67]" />}
                >
                  Live Demo
                </Button>
              </Link>
            </div>

            {/* Trust Indicators / Social Proof */}
            <div className="pt-6 border-t border-[#E6EBE8] dark:border-[#212E29] flex items-center gap-4">
              <div className="flex -space-x-2">
                {featuredMembers.map((user, i) => (
                  <Avatar
                    key={i}
                    name={user.name}
                    size="sm"
                    className="ring-2 ring-white dark:ring-[#101614]"
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs font-semibold text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                  Trusted by <span className="text-[#17211D] dark:text-[#F1F5F3]">1M+ users</span> worldwide
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Product Mockup */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <HeroChatPreview />
          </div>
        </div>
      </main>

      {/* Feature Strip */}
      <FeatureStrip />

      {/* Minimal Footer */}
      <footer className="border-t border-[#E6EBE8] dark:border-[#212E29] py-6 text-center text-xs text-[#66736D] dark:text-[#8E9C95] bg-white dark:bg-[#101614]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 FluxChat Inc. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-[#17211D] dark:hover:text-white">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-[#17211D] dark:hover:text-white">
              Create Account
            </Link>
            <Link href="/app/chats" className="text-[#168F67] font-semibold hover:underline">
              Launch App
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
