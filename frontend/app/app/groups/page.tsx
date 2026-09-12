"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Lock,
  Globe,
  MessageSquare,
  Info,
  Check,
  UserCheck,
  Sparkles,
  Shield,
  Circle,
  Bell,
  BellOff,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Group } from "@/types/group";
import { cn } from "@/lib/utils/cn";
import { getStoredToken } from "@/lib/api/auth";
import { getContacts } from "@/lib/api/contact";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; username: string; avatar?: string; isOnline?: boolean }[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "joined" | "discover" | "my">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentUserName, setCurrentUserName] = useState("You");
  const [currentUserId, setCurrentUserId] = useState("u_me");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("fluxchat_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.name) setCurrentUserName(u.name);
          if (u.id) setCurrentUserId(u.id);
        } catch {}
      }
    }

    const token = getStoredToken();
    if (token) {
      getContacts(token).then((res) => {
        if (res.items) {
          setContacts(
            res.items.map((i) => ({
              id: i.contact_id,
              name: i.user.name,
              username: i.user.username,
              avatar: i.user.avatar || undefined,
              isOnline: i.user.is_online,
            }))
          );
        }
      }).catch(() => {});
    }
  }, []);

  // Create Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupCategory, setGroupCategory] = useState<"work" | "social" | "family" | "tech" | "general">("work");
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedEmoji, setSelectedEmoji] = useState("🚀");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Group Info Modal
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleConfirmDeleteGroup = () => {
    if (!groupToDelete) return;
    const name = groupToDelete.name;
    setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id));
    setGroupToDelete(null);
    setToastMessage(`Group "${name}" was deleted.`);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const emojis = ["🚀", "🎨", "⚡️", "💻", "🏡", "✨", "🌲", "📱", "🎯", "🔥", "☕️", "🏆"];

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "work", label: "Work & Team" },
    { id: "tech", label: "Tech & Dev" },
    { id: "social", label: "Social & Outing" },
    { id: "family", label: "Family & Home" },
    { id: "general", label: "Community" },
  ];

  // Filter groups
  const filteredGroups = groups.filter((g) => {
    // Tab filter
    if (activeTab === "joined" && !g.isJoined) return false;
    if (activeTab === "discover" && (g.isJoined || g.isPrivate)) return false;
    if (activeTab === "my" && g.createdBy !== currentUserName && g.createdBy !== "You") return false;

    // Category filter
    if (selectedCategory !== "all" && g.category !== selectedCategory) return false;

    // Search query
    if (
      searchQuery &&
      !g.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !g.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const handleToggleJoin = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const nextJoined = !g.isJoined;
          setToastMessage(nextJoined ? `Joined "${g.name}"!` : `Left "${g.name}"`);
          setTimeout(() => setToastMessage(""), 3000);
          return {
            ...g,
            isJoined: nextJoined,
            memberCount: nextJoined ? g.memberCount + 1 : g.memberCount - 1,
          };
        }
        return g;
      })
    );
  };

  const handleToggleMemberSelect = (contactId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const newGroup: Group = {
      id: `g_custom_${Date.now()}`,
      conversationId: "c2", // links to active group chat
      name: groupName.trim(),
      description: groupDesc.trim() || "A new collaborative group on FluxChat.",
      category: groupCategory,
      avatarEmoji: selectedEmoji,
      avatarColor: "var(--primary)",
      isPrivate: isPrivate,
      createdBy: currentUserName,
      isJoined: true,
      memberCount: selectedMembers.length + 1,
      onlineCount: Math.ceil((selectedMembers.length + 1) / 2),
      lastActivity: "Just now",
      lastMessage: "Group created! Start chatting with your members.",
      members: [
        { id: currentUserId, name: currentUserName, role: "admin", isOnline: true },
        ...selectedMembers.map((id) => {
          const contact = contacts.find((c) => c.id === id);
          return {
            id,
            name: contact?.name || "Member",
            role: "member" as const,
            isOnline: contact?.isOnline || false,
          };
        }),
      ],
    };

    setGroups((prev) => [newGroup, ...prev]);
    setGroupName("");
    setGroupDesc("");
    setIsCreateModalOpen(false);
    setToastMessage(`Group "${newGroup.name}" created successfully!`);
    setTimeout(() => setToastMessage(""), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-y-auto select-none transition-colors">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-[#E6EBE8] dark:border-[#212E29] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Groups & Communities
            </h1>
          </div>
          <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
            Connect, brainstorm, and collaborate with your team squads and circles.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Group</span>
        </Button>
      </div>

      {/* Main Container */}
      <div className="p-4 sm:p-6 max-w-5xl space-y-6 text-left">
        {toastMessage && (
          <div className="p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Filter Controls: Tabs + Search */}
        <div className="space-y-3">
          {/* Navigation Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F7F9F8] dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] text-xs font-semibold">
              {[
                { id: "all", label: "All Groups", count: groups.length },
                { id: "joined", label: "Joined", count: groups.filter((g) => g.isJoined).length },
                { id: "discover", label: "Public Discover", count: groups.filter((g) => !g.isJoined && !g.isPrivate).length },
                { id: "my", label: "Created by Me", count: groups.filter((g) => g.createdBy === currentUserName || g.createdBy === "You").length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as "all" | "joined" | "discover" | "my")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    activeTab === tab.id
                      ? "bg-white dark:bg-[#1D2723] text-[var(--primary)] shadow-xs font-bold"
                      : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-white"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      activeTab === tab.id
                        ? "bg-[var(--primary-light)] text-[var(--primary)]"
                        : "bg-[#E6EBE8] dark:bg-[#212E29] text-[#66736D]"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Real-time Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#66736D] dark:text-[#8E9C95]" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)] transition-all"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                  selectedCategory === cat.id
                    ? "bg-[var(--primary)] text-white shadow-xs font-semibold"
                    : "bg-[#F7F9F8] dark:bg-[#151D1A] text-[#66736D] dark:text-[#8E9C95] hover:bg-[#E6EBE8] dark:hover:bg-[#1D2723]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Group Cards Grid */}
        {filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((group) => (
              <Card
                key={group.id}
                className="p-5 border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] flex flex-col justify-between hover:shadow-flux-md transition-all group"
              >
                <div>
                  {/* Top Row: Avatar & Privacy Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: group.avatarColor || "var(--primary-light)" }}
                      >
                        <span>{group.avatarEmoji || "👥"}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                            {group.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                          <span>{group.memberCount} members</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Circle className="w-1.5 h-1.5 fill-current" />
                            {group.onlineCount} online
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Privacy Pill */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F7F9F8] dark:bg-[#1D2723] text-[#66736D] dark:text-[#8E9C95] border border-[#E6EBE8]/60 dark:border-[#212E29]/60 shrink-0">
                      {group.isPrivate ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span>Private</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-sky-500" />
                          <span>Public</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-3 line-clamp-2 leading-relaxed">
                    {group.description}
                  </p>

                  {/* Recent Activity */}
                  {group.lastMessage && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-[#1A2420] text-xs text-[#17211D] dark:text-[#F1F5F3] flex items-center justify-between gap-2 border border-[#E6EBE8]/50 dark:border-[#212E29]/50">
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="w-3.5 h-3.5 text-[#66736D] dark:text-[#8E9C95] shrink-0" />
                        <span className="truncate text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                          {group.lastMessage}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95] shrink-0 font-medium">
                        {group.lastActivity}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupInfo(group)}
                      className="p-1.5 rounded-lg text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-white hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors cursor-pointer"
                      title="View Group Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    {(group.createdBy === currentUserName || group.createdBy === "You") && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                          Admin
                        </span>
                        <button
                          type="button"
                          onClick={() => setGroupToDelete(group)}
                          title="Delete Group"
                          className="p-1.5 rounded-lg text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {group.isJoined ? (
                      <>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => router.push(`/app/chats/${group.conversationId || "c2"}`)}
                          className="gap-1.5 text-xs h-8"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open Chat</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleToggleJoin(group.id)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          Leave
                        </button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleToggleJoin(group.id)}
                        className="gap-1.5 text-xs h-8"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Join Group</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center space-y-2 border-[#E6EBE8] dark:border-[#212E29]">
            <Users className="w-8 h-8 mx-auto text-[#66736D] dark:text-[#8E9C95] opacity-50" />
            <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
              No groups found
            </h3>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
              Try adjusting your search query or filter settings, or create a brand new group!
            </p>
          </Card>
        )}
      </div>

      {/* ========================================================= */}
      {/* CREATE GROUP MODAL                                        */}
      {/* ========================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Group"
        size="md"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4 text-left">
          {/* Group Icon & Name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-2xl flex items-center justify-center shrink-0">
              <span>{selectedEmoji}</span>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Design Team, Weekend Runners..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* Emoji Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
              Choose Group Icon
            </label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer shrink-0",
                    selectedEmoji === emoji
                      ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)] scale-110"
                      : "bg-[#F7F9F8] dark:bg-[#1D2723] hover:scale-105"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Group Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
              Description & Purpose
            </label>
            <textarea
              rows={2}
              placeholder="What is this group about?"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Category & Privacy */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
                Category
              </label>
              <select
                value={groupCategory}
                onChange={(e) => setGroupCategory(e.target.value as "work" | "social" | "family" | "tech" | "general")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="work">Work & Team</option>
                <option value="tech">Tech & Dev</option>
                <option value="social">Social & Outing</option>
                <option value="family">Family & Home</option>
                <option value="general">General Community</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
                Privacy Type
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer",
                    isPrivate
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                      : "border-[#E6EBE8] dark:border-[#212E29] text-[#66736D]"
                  )}
                >
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer",
                    !isPrivate
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                      : "border-[#E6EBE8] dark:border-[#212E29] text-[#66736D]"
                  )}
                >
                  Public
                </button>
              </div>
            </div>
          </div>

          {/* Add Members from Contacts */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
              Add Members ({selectedMembers.length} selected)
            </label>
            <div className="max-h-40 overflow-y-auto divide-y divide-[#E6EBE8] dark:divide-[#212E29] border border-[#E6EBE8] dark:border-[#212E29] rounded-xl p-1 bg-[#F7F9F8]/50 dark:bg-[#151D1A]/50">
              {contacts.length > 0 ? (
                contacts.map((contact) => {
                  const isSelected = selectedMembers.includes(contact.id);
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleToggleMemberSelect(contact.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-[#1D2723] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={contact.name} size="sm" isOnline={contact.isOnline} />
                        <div>
                          <div className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                            {contact.name}
                          </div>
                          <div className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                            @{contact.username}
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                            : "border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A]"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-[#66736D] dark:text-[#8E9C95]">
                  No contacts found. Add contacts first to invite them to this group.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
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
              <Plus className="w-3.5 h-3.5" />
              <span>Create Group</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* GROUP INFO MODAL                                          */}
      {/* ========================================================= */}
      {selectedGroupInfo && (
        <Modal
          isOpen={Boolean(selectedGroupInfo)}
          onClose={() => setSelectedGroupInfo(null)}
          title="Group Details"
          size="md"
        >
          <div className="space-y-4 text-left">
            {/* Group Header Card */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#F7F9F8] dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29]">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs shrink-0"
                style={{ backgroundColor: selectedGroupInfo.avatarColor || "var(--primary-light)" }}
              >
                <span>{selectedGroupInfo.avatarEmoji || "👥"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                    {selectedGroupInfo.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#1D2723] font-semibold border border-[#E6EBE8] dark:border-[#212E29]">
                    {selectedGroupInfo.isPrivate ? "Private" : "Public"}
                  </span>
                </div>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                  Created by {selectedGroupInfo.createdBy}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
                About
              </span>
              <p className="text-xs text-[#17211D] dark:text-[#F1F5F3] leading-relaxed">
                {selectedGroupInfo.description}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A]">
              <div className="flex items-center gap-2">
                {isMuted ? (
                  <BellOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <Bell className="w-4 h-4 text-[#66736D] dark:text-[#8E9C95]" />
                )}
                <span className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                  Mute notifications
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer",
                  isMuted
                    ? "border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                    : "border-[#E6EBE8] dark:border-[#212E29] text-[#66736D]"
                )}
              >
                {isMuted ? "Muted" : "Active"}
              </button>
            </div>

            {/* Member Roster */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#66736D] dark:text-[#8E9C95]">
                <span>Members ({selectedGroupInfo.members.length})</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  {selectedGroupInfo.onlineCount} online
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-[#E6EBE8] dark:divide-[#212E29] border border-[#E6EBE8] dark:border-[#212E29] rounded-xl p-1">
                {selectedGroupInfo.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="sm" isOnline={member.isOnline} />
                      <div>
                        <div className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                          {member.isOnline ? "Online now" : "Offline"}
                        </div>
                      </div>
                    </div>
                    {member.role === "admin" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
              {selectedGroupInfo.createdBy === "John Doe" ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = selectedGroupInfo;
                    setSelectedGroupInfo(null);
                    setGroupToDelete(toDelete);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete this group</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleJoin(selectedGroupInfo.id);
                    setSelectedGroupInfo(null);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  {selectedGroupInfo.isJoined ? "Leave this group" : "Join this group"}
                </button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedGroupInfo(null);
                  router.push(`/app/chats/${selectedGroupInfo.conversationId || "c2"}`);
                }}
                className="gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Chat</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Group Confirmation Modal */}
      <Modal
        isOpen={Boolean(groupToDelete)}
        onClose={() => setGroupToDelete(null)}
        title="Delete Group"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Delete &ldquo;{groupToDelete?.name}&rdquo;?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                Are you sure you want to permanently delete this group? All members will be removed and message history will be lost.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setGroupToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDeleteGroup}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Group</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
