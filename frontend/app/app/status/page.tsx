"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  CircleDot,
  Eye,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { UserStatus, StatusSlide } from "@/types/status";
import { cn } from "@/lib/utils/cn";

export default function StatusPage() {
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [userName, setUserName] = useState("My Status");
  const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("fluxchat_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.name) setUserName(u.name);
        } catch {}
      }
    }
  }, []);

  // Create status modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [selectedGradient, setSelectedGradient] = useState("from-emerald-600 to-teal-800");
  const [fontStyle, setFontStyle] = useState<"modern" | "serif" | "mono" | "bold">("modern");

  // Status viewer reply state
  const [replyText, setReplyText] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const gradients = [
    { id: "emerald", label: "Emerald Teal", class: "from-emerald-600 to-teal-800" },
    { id: "indigo", label: "Ocean Indigo", class: "from-blue-600 via-indigo-600 to-teal-600" },
    { id: "sunset", label: "Sunset Glow", class: "from-amber-500 via-rose-600 to-purple-800" },
    { id: "coffee", label: "Warm Coffee", class: "from-amber-700 via-stone-800 to-zinc-900" },
    { id: "violet", label: "Electric Violet", class: "from-violet-600 to-indigo-900" },
    { id: "rose", label: "Velvet Rose", class: "from-pink-600 to-rose-900" },
  ];

  const myStatus = statuses.find((s) => s.isMe);
  const recentUpdates = statuses.filter((s) => !s.isMe && !s.viewed);
  const viewedUpdates = statuses.filter((s) => !s.isMe && s.viewed);

  const activeStatus = activeStatusIndex !== null ? statuses[activeStatusIndex] : null;
  const currentSlide = activeStatus ? activeStatus.slides[activeSlideIndex] : null;

  // Auto-advance slide progress timer when viewing
  useEffect(() => {
    if (!activeStatus || isPaused) return;

    const timer = setTimeout(() => {
      if (activeSlideIndex < activeStatus.slides.length - 1) {
        setActiveSlideIndex((prev) => prev + 1);
      } else {
        // Move to next user's status or close if end
        if (activeStatusIndex !== null && activeStatusIndex < statuses.length - 1) {
          setActiveStatusIndex(activeStatusIndex + 1);
          setActiveSlideIndex(0);
        } else {
          setActiveStatusIndex(null);
          setActiveSlideIndex(0);
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeStatus, activeSlideIndex, isPaused, activeStatusIndex, statuses.length]);

  const handleOpenStatus = (statusId: string) => {
    const idx = statuses.findIndex((s) => s.id === statusId);
    if (idx !== -1) {
      setActiveStatusIndex(idx);
      setActiveSlideIndex(0);
      // Mark as viewed
      setStatuses((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, viewed: true } : s))
      );
    }
  };

  const handleNextSlide = () => {
    if (!activeStatus) return;
    if (activeSlideIndex < activeStatus.slides.length - 1) {
      setActiveSlideIndex((prev) => prev + 1);
    } else if (activeStatusIndex !== null && activeStatusIndex < statuses.length - 1) {
      setActiveStatusIndex(activeStatusIndex + 1);
      setActiveSlideIndex(0);
    } else {
      setActiveStatusIndex(null);
    }
  };

  const handlePrevSlide = () => {
    if (!activeStatus) return;
    if (activeSlideIndex > 0) {
      setActiveSlideIndex((prev) => prev - 1);
    } else if (activeStatusIndex !== null && activeStatusIndex > 0) {
      setActiveStatusIndex(activeStatusIndex - 1);
      const prevStatus = statuses[activeStatusIndex - 1];
      setActiveSlideIndex(prevStatus.slides.length - 1);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setToastMessage(`Reply sent to ${activeStatus?.userName}!`);
    setReplyText("");
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleQuickReaction = (emoji: string) => {
    setToastMessage(`Sent ${emoji} reaction to ${activeStatus?.userName}!`);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleCreateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusText.trim()) return;

    const newSlide: StatusSlide = {
      id: `slide_custom_${Date.now()}`,
      type: "text",
      content: statusText.trim(),
      backgroundColor: selectedGradient,
      fontStyle: fontStyle,
      createdAt: "Just now",
    };

    setStatuses((prev) => {
      const myIdx = prev.findIndex((s) => s.isMe);
      if (myIdx !== -1) {
        const updatedMe = {
          ...prev[myIdx],
          lastUpdated: "Just now",
          slides: [newSlide, ...prev[myIdx].slides],
        };
        return [updatedMe, ...prev.filter((_, i) => i !== myIdx)];
      } else {
        const initials =
          userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "ME";

        const newMe: UserStatus = {
          id: `status_me_${Date.now()}`,
          userId: "u_me",
          userName: userName,
          userInitials: initials,
          isMe: true,
          viewed: false,
          lastUpdated: "Just now",
          slides: [newSlide],
        };
        return [newMe, ...prev];
      }
    });

    setStatusText("");
    setIsCreateModalOpen(false);
    setToastMessage("Status posted successfully!");
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleDeleteMyStatus = () => {
    setStatuses((prev) =>
      prev.map((s) => (s.isMe ? { ...s, slides: [] } : s))
    );
    setToastMessage("Your status story was deleted.");
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleDeleteCurrentSlide = () => {
    if (!activeStatus) return;
    const remainingSlides = activeStatus.slides.filter((_, i) => i !== activeSlideIndex);
    if (remainingSlides.length === 0) {
      setStatuses((prev) =>
        prev.map((s) => (s.id === activeStatus.id ? { ...s, slides: [] } : s))
      );
      setActiveStatusIndex(null);
    } else {
      setStatuses((prev) =>
        prev.map((s) =>
          s.id === activeStatus.id ? { ...s, slides: remainingSlides } : s
        )
      );
      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
    }
    setToastMessage("Story slide deleted.");
    setTimeout(() => setToastMessage(""), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-y-auto select-none transition-colors">
      {/* Page Header */}
      <div className="p-4 sm:p-6 border-b border-[#E6EBE8] dark:border-[#212E29] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
              <CircleDot className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Status & Stories
            </h1>
          </div>
          <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
            Share updates that disappear in 24 hours with your connections.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Status</span>
        </Button>
      </div>

      {/* Main Content Body */}
      <div className="p-4 sm:p-6 max-w-4xl space-y-6 text-left">
        {toastMessage && (
          <div className="p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* My Status Card */}
        <Card className="p-4 sm:p-5 border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {/* Avatar with Status Ring */}
              <div className="relative cursor-pointer" onClick={() => myStatus && handleOpenStatus(myStatus.id)}>
                <div className="p-0.5 rounded-full ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-white dark:ring-offset-[#151D1A]">
                  <Avatar name={userName} size="lg" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateModalOpen(true);
                  }}
                  title="Add new story"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center border-2 border-white dark:border-[#151D1A] shadow-xs hover:scale-110 transition-transform cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  My Status
                </h3>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                  {myStatus && myStatus.slides.length > 0
                    ? `${myStatus.slides.length} active updates • ${myStatus.lastUpdated}`
                    : "Tap to share what's on your mind"}
                </p>
              </div>
            </div>

            {myStatus && myStatus.slides.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => handleOpenStatus(myStatus.id)}
                  className="gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View My Story</span>
                </Button>
                <button
                  type="button"
                  onClick={handleDeleteMyStatus}
                  title="Delete my status story"
                  className="p-2 rounded-xl text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Updates (Unviewed) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
              Recent Updates ({recentUpdates.length})
            </h2>
            <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
              Tap to view
            </span>
          </div>

          {recentUpdates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentUpdates.map((status) => {
                const previewSlide = status.slides[0];
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => handleOpenStatus(status.id)}
                    className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-all text-left cursor-pointer group shadow-flux"
                  >
                    {/* Ringed Avatar */}
                    <div className="relative shrink-0">
                      <div className="p-0.5 rounded-full ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-white dark:ring-offset-[#151D1A] group-hover:scale-105 transition-transform">
                        <Avatar name={status.userName} size="md" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                          {status.userName}
                        </h4>
                        <span className="text-[10px] font-medium text-[#66736D] dark:text-[#8E9C95] shrink-0">
                          {status.lastUpdated}
                        </span>
                      </div>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate mt-0.5">
                        {previewSlide?.content}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-xs text-[#66736D] dark:text-[#8E9C95] border-[#E6EBE8] dark:border-[#212E29]">
              No new unviewed updates right now. Check back later!
            </Card>
          )}
        </div>

        {/* Viewed Updates */}
        {viewedUpdates.length > 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95] px-1">
              Viewed Updates ({viewedUpdates.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {viewedUpdates.map((status) => {
                const previewSlide = status.slides[0];
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => handleOpenStatus(status.id)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl border border-[#E6EBE8]/60 dark:border-[#212E29]/60 bg-white/60 dark:bg-[#151D1A]/60 hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-all text-left cursor-pointer opacity-80 hover:opacity-100"
                  >
                    {/* Muted Avatar */}
                    <div className="p-0.5 rounded-full ring-2 ring-slate-300 dark:ring-slate-700 ring-offset-1 ring-offset-white dark:ring-offset-[#151D1A] shrink-0">
                      <Avatar name={status.userName} size="md" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                          {status.userName}
                        </h4>
                        <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                          {status.lastUpdated}
                        </span>
                      </div>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate mt-0.5">
                        {previewSlide?.content}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* FULLSCREEN STORY VIEWER MODAL                             */}
      {/* ========================================================= */}
      {activeStatus && currentSlide && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md h-[90vh] max-h-[740px] rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-slate-950 border border-white/10"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Top Multi-Segment Progress Bars */}
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
              {activeStatus.slides.map((_, idx) => (
                <div
                  key={idx}
                  className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-full bg-white transition-all duration-100",
                      idx < activeSlideIndex
                        ? "w-full"
                        : idx === activeSlideIndex
                        ? "w-full"
                        : "w-0"
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Top Info Bar (Creator info + Close) */}
            <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Avatar name={activeStatus.userName} size="sm" />
                <div>
                  <div className="text-xs font-bold leading-tight drop-shadow">
                    {activeStatus.userName}
                  </div>
                  <div className="text-[10px] text-white/70 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{currentSlide.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeStatus.isMe && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentSlide}
                    title="Delete this slide"
                    className="p-1.5 rounded-full bg-black/40 hover:bg-rose-600/80 text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveStatusIndex(null)}
                  className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slide Body (Gradient Background + Content) */}
            <div
              className={cn(
                "flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br text-white text-center select-text relative",
                currentSlide.backgroundColor || "from-emerald-600 to-teal-800"
              )}
            >
              {/* Navigation Left / Right click targets */}
              <button
                type="button"
                onClick={handlePrevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/80 transition-colors z-20 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 hover:bg-black/50 text-white/80 transition-colors z-20 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="max-w-xs space-y-4 px-2">
                <p
                  className={cn(
                    "text-xl sm:text-2xl leading-relaxed tracking-tight drop-shadow-md",
                    currentSlide.fontStyle === "serif"
                      ? "font-serif italic"
                      : currentSlide.fontStyle === "mono"
                      ? "font-mono"
                      : currentSlide.fontStyle === "bold"
                      ? "font-extrabold uppercase"
                      : "font-semibold"
                  )}
                >
                  &ldquo;{currentSlide.content}&rdquo;
                </p>

                {currentSlide.caption && (
                  <div className="inline-block px-3 py-1 rounded-full bg-black/30 backdrop-blur-xs text-xs font-medium text-white/90">
                    📍 {currentSlide.caption}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Interactive Bar (Reaction emojis + Reply input) */}
            <div className="p-3 bg-black/70 backdrop-blur-md border-t border-white/10 space-y-2 z-30">
              {/* Quick Reactions */}
              <div className="flex items-center justify-around py-0.5">
                {["❤️", "🔥", "😂", "👏", "🎉", "🚀"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickReaction(emoji)}
                    className="text-lg hover:scale-130 active:scale-95 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Reply to ${activeStatus.userName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-white/50"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="p-2 rounded-full bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CREATE STATUS MODAL                                       */}
      {/* ========================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Status"
        size="md"
      >
        <form onSubmit={handleCreateStatus} className="space-y-4 text-left">
          {/* Status Message */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
              Status Text
            </label>
            <textarea
              rows={3}
              placeholder="What's happening today?"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-sm text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Background Gradient Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
              Theme Background
            </label>
            <div className="grid grid-cols-6 gap-2">
              {gradients.map((grad) => (
                <button
                  key={grad.id}
                  type="button"
                  onClick={() => setSelectedGradient(grad.class)}
                  title={grad.label}
                  className={cn(
                    "h-8 rounded-lg bg-gradient-to-br transition-transform cursor-pointer",
                    grad.class,
                    selectedGradient === grad.class
                      ? "ring-2 ring-offset-2 ring-[var(--primary)] scale-105"
                      : "opacity-80 hover:opacity-100"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Font Style */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
              Typography Style
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["modern", "serif", "mono", "bold"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setFontStyle(style)}
                  className={cn(
                    "py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors cursor-pointer",
                    fontStyle === style
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-bold"
                      : "border-[#E6EBE8] dark:border-[#212E29] text-[#66736D] dark:text-[#8E9C95]"
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview of the Status */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95] mb-1.5">
              Live Preview
            </label>
            <div
              className={cn(
                "p-6 rounded-2xl bg-gradient-to-br text-white text-center shadow-xs flex items-center justify-center min-h-[110px]",
                selectedGradient
              )}
            >
              <p
                className={cn(
                  "text-sm",
                  fontStyle === "serif"
                    ? "font-serif italic"
                    : fontStyle === "mono"
                    ? "font-mono"
                    : fontStyle === "bold"
                    ? "font-extrabold uppercase"
                    : "font-semibold"
                )}
              >
                {statusText.trim() || "Your status text will appear like this..."}
              </p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Post to My Status</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
