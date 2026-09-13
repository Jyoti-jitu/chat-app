"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, SquarePen, Users, MessageSquare, Loader2, Plus, Check, Camera, Shield, UserCheck, Image as ImageIcon } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { ConversationItem } from "./ConversationItem";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Conversation } from "@/types/conversation";
import { useRouter } from "next/navigation";
import {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  deleteConversation,
} from "@/lib/api/chat";
import { getContacts, ContactItem } from "@/lib/api/contact";
import { wsClient } from "@/lib/api/websocket";
import { uploadMedia } from "@/lib/api/media";

export interface ConversationListProps {
  activeId?: string;
  className?: string;
}

export function ConversationList({ activeId, className }: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [activeSection, setActiveSection] = useState<"primary" | "general">("primary");
  const activeIdRef = React.useRef(activeId);
  React.useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const [currentUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("fluxchat_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.id) return u.id;
        } catch {}
      }
      const token =
        localStorage.getItem("fluxchat_access_token") ||
        localStorage.getItem("accessToken");
      if (token) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.sub) return payload.sub;
          }
        } catch {}
      }
    }
    return "";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [groupJoinMode, setGroupJoinMode] = useState<"open" | "approval">("open");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return (
      localStorage.getItem("fluxchat_access_token") ||
      localStorage.getItem("accessToken")
    );
  };

  const contactsRef = React.useRef<ContactItem[]>([]);

  const fetchConversations = useCallback(async (silent = false) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      if (!silent) setIsLoading(true);

      let myUserId = currentUserId;
      if (!myUserId) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.sub) myUserId = payload.sub;
          }
        } catch {}
      }

      // Fetch contacts only on initial load or non-silent refresh
      let contactItems = contactsRef.current;
      if (!silent || contactItems.length === 0) {
        try {
          const contactsRes = await getContacts(token);
          if (contactsRes.items) {
            contactItems = contactsRes.items;
            contactsRef.current = contactItems;
            setContacts(contactItems);
          }
        } catch (err: any) {
          if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
            router.push("/login");
            return;
          }
        }
      }

      const confirmedContactIds = new Set(contactItems.map((c) => c.contact_id));
      const res = await getConversations(50, 0, token).catch((err) => {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
          router.push("/login");
        }
        return { items: null as any };
      });

      if (res.items && res.items.length > 0) {
        const mapped: Conversation[] = res.items.map((item: any) => {
          const otherMember =
            item.members?.find((m: any) => m.id !== myUserId) ||
            item.member_ids?.find((id: string) => id !== myUserId);
          const otherUserId =
            typeof otherMember === "string" ? otherMember : otherMember?.id;

          // Section classification:
          // Direct chats with confirmed contacts -> "primary"
          // Direct chats with unconfirmed / pending connections -> "general"
          // Group chats -> "primary"
          const isDirect = item.type === "direct";
          const isConfirmed = Boolean(otherUserId && confirmedContactIds.has(otherUserId));
          const section: "primary" | "general" =
            isDirect && !isConfirmed ? "general" : "primary";

          return {
            id: item.id,
            type: item.type,
            name: item.name || (item.type === "group" ? "Group Chat" : "Direct Chat"),
            avatar: item.avatar || undefined,
            members: item.member_ids,
            otherUserId: otherUserId,
            section: section,
            lastMessage: item.last_message?.content || "No messages yet",
            lastMessageTime: item.last_message?.timestamp
              ? new Date(item.last_message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : item.updated_at
              ? new Date(item.updated_at).toLocaleDateString()
              : undefined,
            unreadCount: item.unread_count || 0,
            isOnline: item.members?.some((m: any) => m.is_online) || false,
          };
        });
        setConversations(mapped);

        // If Primary section is empty but General has conversations, auto-switch to General
        const hasPrimary = mapped.some((c: Conversation) => (c.section || "primary") === "primary");
        const hasGeneral = mapped.some((c: Conversation) => c.section === "general");
        if (!hasPrimary && hasGeneral && !activeIdRef.current) {
          setActiveSection("general");
        }
      } else if (res.items !== null) {
        setConversations([]);
      }
    } catch (err: any) {
      console.warn("Could not fetch live conversations:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, router]);

  const fetchContactsList = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await getContacts(token);
      if (res.items) {
        contactsRef.current = res.items;
        setContacts(res.items);
      }
    } catch (err: any) {
      console.warn("Could not fetch contacts for chat picker:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    const handleWsMessage = (payload: any) => {
      const msgData = payload.data || payload;
      if (!msgData || !msgData.conversation_id) return;

      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === msgData.conversation_id);
        const timeFormatted = msgData.created_at
          ? new Date(msgData.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Now";

        if (existingIdx >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIdx] };
          conv.lastMessage = msgData.content;
          conv.lastMessageTime = timeFormatted;
          if (activeIdRef.current !== conv.id && msgData.sender_id !== currentUserId) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          }
          updated.splice(existingIdx, 1);
          if (conv.section && msgData.sender_id !== currentUserId) {
            setActiveSection(conv.section);
          }
          return [conv, ...updated];
        } else {
          fetchConversations(false);
          return prev;
        }
      });
    };

    const handleConversationDeleted = (payload: any) => {
      const convId =
        payload.data?.conversation_id ||
        payload.conversation_id ||
        payload.data?.id ||
        payload.id;
      if (!convId) return;
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeIdRef.current === convId) {
        router.push("/app/chats");
      }
    };

    const handleUserOnline = (payload: any) => {
      const uid = payload.data?.user_id || payload.user_id;
      if (!uid) return;
      setConversations((prev) =>
        prev.map((c) => (c.otherUserId === uid ? { ...c, isOnline: true } : c))
      );
    };

    const handleUserOffline = (payload: any) => {
      const uid = payload.data?.user_id || payload.user_id;
      if (!uid) return;
      setConversations((prev) =>
        prev.map((c) => (c.otherUserId === uid ? { ...c, isOnline: false } : c))
      );
    };

    wsClient.on("message.new", handleWsMessage);
    wsClient.on("conversation.deleted", handleConversationDeleted);
    wsClient.on("user.online", handleUserOnline);
    wsClient.on("user.offline", handleUserOffline);

    // Silent periodic refresh every 25 seconds to keep conversations completely in sync
    const pollInterval = setInterval(() => {
      fetchConversations(true);
    }, 25000);

    return () => {
      wsClient.off("message.new", handleWsMessage);
      wsClient.off("conversation.deleted", handleConversationDeleted);
      wsClient.off("user.online", handleUserOnline);
      wsClient.off("user.offline", handleUserOffline);
      clearInterval(pollInterval);
    };
  }, [fetchConversations, fetchContactsList, currentUserId, router]);

  // Clear unread count on active conversation and sync section
  useEffect(() => {
    if (activeId) {
      setConversations((prev) => {
        const target = prev.find(
          (c) => c.id === activeId || (c.otherUserId && activeId === `c_${c.otherUserId}`)
        );
        if (!target) return prev;
        if (target.section) {
          setActiveSection(target.section);
        }
        if (target.unreadCount > 0) {
          return prev.map((c) => (c.id === target.id ? { ...c, unreadCount: 0 } : c));
        }
        return prev;
      });
    }
  }, [activeId]);

  const handleDeleteConversation = async (id: string) => {
    const token = getAuthToken();

    if (token) {
      try {
        await deleteConversation(id, token);
      } catch (err: any) {
        console.warn("Error deleting conversation:", err.message);
      }
    }

    setConversations((prev) => prev.filter((c) => c.id !== id && c.otherUserId !== id.replace(/^c_/, "")));
    if (activeId === id || activeId === `c_${id}`) {
      router.push("/app/chats");
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    const token = getAuthToken();

    if (token) {
      try {
        setIsCreating(true);
        const conv = await createOrGetDirectConversation(targetUserId, token);
        setIsNewChatModalOpen(false);
        await fetchConversations();
        router.push(`/app/chats/${conv.id}`);
        setTimeout(() => {
          const textarea = document.getElementById("chat-message-input") as HTMLTextAreaElement | null;
          if (textarea) {
            textarea.focus();
            if (textarea.value) textarea.select();
          }
        }, 100);
      } catch (err: any) {
        alert(err.message || "Failed to start direct conversation");
      } finally {
        setIsCreating(false);
      }
    } else {
      setIsNewChatModalOpen(false);
      router.push("/app/chats/c1");
      setTimeout(() => {
        const textarea = document.getElementById("chat-message-input") as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.focus();
          if (textarea.value) textarea.select();
        }
      }, 100);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getAuthToken();
    try {
      setIsUploadingAvatar(true);
      const res = await uploadMedia(file, "fluxchat/groups", token || undefined);
      setGroupAvatarUrl(res.url);
    } catch (err: any) {
      alert(err.message || "Failed to upload group avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      setIsCreating(true);
      const conv = await createGroupConversation(
        {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          avatar: groupAvatarUrl || undefined,
          join_mode: groupJoinMode,
          member_ids: selectedContactIds,
        },
        token
      );
      setIsNewChatModalOpen(false);
      setGroupName("");
      setGroupDescription("");
      setGroupAvatarUrl(null);
      setGroupJoinMode("open");
      setSelectedContactIds([]);
      await fetchConversations();
      router.push(`/app/chats/${conv.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create group conversation");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const primaryConversations = conversations.filter(
    (c) => (c.section || "primary") === "primary"
  );
  const generalConversations = conversations.filter(
    (c) => c.section === "general"
  );

  const primaryCount = primaryConversations.length;
  const generalCount = generalConversations.length;

  const activeSectionList =
    activeSection === "primary" ? primaryConversations : generalConversations;

  const tabs = [
    { id: "all", label: "All" },
    {
      id: "unread",
      label: "Unread",
      count:
        activeSectionList.filter((c) => c.unreadCount > 0).length || undefined,
    },
    ...(activeSection === "primary" ? [{ id: "groups", label: "Groups" }] : []),
    { id: "favorites", label: "Favorites" },
  ];

  const filteredConversations = activeSectionList.filter((conv) => {
    const matchesSearch =
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "unread") return conv.unreadCount > 0;
    if (activeTab === "groups") return conv.type === "group";
    if (activeTab === "favorites") return conv.isPinned;
    return true;
  });

  return (
    <div
      className={`w-full sm:w-80 md:w-88 h-full bg-white dark:bg-[#151D1A] border-r border-[#E6EBE8] dark:border-[#212E29] flex flex-col shrink-0 transition-colors ${
        className || ""
      }`}
    >
      {/* Top Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29]">
        <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Chats
        </h1>
        <button
          onClick={() => {
            setModalMode("direct");
            setIsNewChatModalOpen(true);
          }}
          title="New conversation"
          className="p-2 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] hover:bg-[#EAF5F0] dark:hover:bg-[#24332D] transition-colors cursor-pointer"
        >
          <SquarePen className="w-4 h-4" />
        </button>
      </div>

      {/* Primary vs General Section Switcher */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-1 p-1 bg-[#F4F6F5] dark:bg-[#1D2723] rounded-xl border border-[#E6EBE8] dark:border-[#212E29]">
          <button
            onClick={() => {
              setActiveSection("primary");
              setActiveTab("all");
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "primary"
                ? "bg-white dark:bg-[#151D1A] text-[#168F67] dark:text-[#22A06B] shadow-xs"
                : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3]"
            }`}
          >
            <span>Primary</span>
            {primaryCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSection === "primary"
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "bg-[#E6EBE8] dark:bg-[#212E29] text-[#66736D] dark:text-[#8E9C95]"
                }`}
              >
                {primaryCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveSection("general");
              setActiveTab("all");
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "general"
                ? "bg-white dark:bg-[#151D1A] text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3]"
            }`}
          >
            <span>General</span>
            {generalCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSection === "general"
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {generalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pt-2 pb-2">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-[#66736D] dark:text-[#8E9C95] pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-transparent pl-9.5 pr-4 py-2 text-xs text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D] focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67]/50 focus:ring-2 focus:ring-[#168F67]/15 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pb-2 border-b border-[#E6EBE8] dark:border-[#212E29]">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {isLoading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[#66736D] dark:text-[#8E9C95]">
            <Loader2 className="w-4 h-4 animate-spin text-[#168F67]" />
            <span>Loading conversations...</span>
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onDelete={handleDeleteConversation}
            />
          ))
        ) : (
          <div className="text-center py-12 px-4 space-y-1.5">
            <p className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
              {activeSection === "general"
                ? "No messages in General"
                : "No conversations found"}
            </p>
            <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] max-w-xs mx-auto">
              {activeSection === "general"
                ? "When you message users with pending connection requests, they appear here until accepted."
                : "Conversations with confirmed contacts and accepted friends appear here."}
            </p>
          </div>
        )}
      </div>

      {/* New Chat / New Group Modal */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        title={modalMode === "direct" ? "New Direct Message" : "Create Group Conversation"}
        description={
          modalMode === "direct"
            ? "Choose a contact to begin a 1:1 conversation."
            : "Name your group and select participants."
        }
      >
        {/* Toggle Mode */}
        <div className="flex items-center gap-2 p-1 bg-[#F4F6F5] dark:bg-[#1D2723] rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setModalMode("direct")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              modalMode === "direct"
                ? "bg-white dark:bg-[#151D1A] text-[#168F67] dark:text-[#22A06B] shadow-xs"
                : "text-[#66736D] dark:text-[#8E9C95]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setModalMode("group")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              modalMode === "group"
                ? "bg-white dark:bg-[#151D1A] text-[#168F67] dark:text-[#22A06B] shadow-xs"
                : "text-[#66736D] dark:text-[#8E9C95]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        </div>

        {modalMode === "direct" ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {contacts.length > 0 ? (
              contacts.map((c) => (
                <div
                  key={c.contact_id}
                  onClick={() => handleStartDirectChat(c.contact_id)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={c.user.name}
                      src={c.user.avatar || undefined}
                      size="sm"
                      isOnline={c.user.is_online}
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3]">
                        {c.user.name}
                      </div>
                      <div className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                        @{c.user.username}
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" disabled={isCreating}>
                    Message
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#66736D] dark:text-[#8E9C95] text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#66736D]" />
                <p className="font-semibold text-sm text-[#17211D] dark:text-[#F1F5F3]">No contacts found</p>
                <p className="text-[11px] mt-1">Add contacts first from the Contacts tab to start a chat.</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateGroup} className="space-y-4">
            {/* Group Avatar Upload */}
            <div className="flex items-center gap-4">
              <div
                onClick={() => groupAvatarInputRef.current?.click()}
                className="relative w-14 h-14 rounded-2xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-dashed border-[#168F67]/40 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-[#168F67] transition-colors shrink-0"
                title="Click to upload group icon"
              >
                {groupAvatarUrl ? (
                  <img src={groupAvatarUrl} alt="Group Icon" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#66736D] dark:text-[#8E9C95]">
                    {isUploadingAvatar ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#168F67]" />
                    ) : (
                      <Camera className="w-5 h-5 group-hover:text-[#168F67] transition-colors" />
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
              <input
                ref={groupAvatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleGroupAvatarUpload}
                className="hidden"
              />
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">Group Icon</p>
                <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">Upload photo via Cloudinary (optional)</p>
              </div>
            </div>

            <Input
              id="groupName"
              label="Group Name"
              placeholder="e.g. Project Alpha, Design Team, Family"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />

            <div>
              <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-1">
                Description (optional)
              </label>
              <textarea
                rows={2}
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="What is this group about?"
                className="w-full text-xs rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-transparent p-2.5 text-[#17211D] dark:text-[#F1F5F3] focus:outline-hidden focus:ring-1 focus:ring-[#168F67]"
              />
            </div>

            {/* Join Mode Selector */}
            <div>
              <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-2">
                Join Policy
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setGroupJoinMode("open")}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    groupJoinMode === "open"
                      ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[#1B2F25] text-[#168F67] dark:text-[#22A06B]"
                      : "border-[#E6EBE8] dark:border-[#212E29] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723]"
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Anyone Can Join</span>
                  </p>
                  <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95] mt-1">
                    Users join immediately upon clicking link
                  </p>
                </div>

                <div
                  onClick={() => setGroupJoinMode("approval")}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    groupJoinMode === "approval"
                      ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[#1B2F25] text-[#168F67] dark:text-[#22A06B]"
                      : "border-[#E6EBE8] dark:border-[#212E29] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723]"
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Approval</span>
                  </p>
                  <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95] mt-1">
                    Admins must approve each join request
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-2">
                Select Initial Participants ({selectedContactIds.length} selected)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-[#E6EBE8] dark:border-[#212E29] rounded-xl p-2">
                {contacts.length > 0 ? (
                  contacts.map((item: any) => {
                    const id = item.contact_id || item.id;
                    const name = item.user?.name || item.name;
                    const username = item.user?.username || item.username;
                    const isSelected = selectedContactIds.includes(id);

                    return (
                      <div
                        key={id}
                        onClick={() => toggleContactSelection(id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[var(--primary-light)] text-[var(--primary)]"
                            : "hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={name} size="sm" />
                          <div className="text-left">
                            <p className="text-xs font-semibold">{name}</p>
                            <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                              @{username}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-[#E6EBE8] text-[#168F67] focus:ring-[#168F67]"
                        />
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-xs text-[#66736D] dark:text-[#8E9C95]">
                    No contacts available yet. You can invite members later!
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE8] dark:border-[#212E29]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsNewChatModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !groupName.trim() || isUploadingAvatar}
              >
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  "Create Group"
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
