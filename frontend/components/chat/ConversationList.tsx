"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, SquarePen, Users, MessageSquare, Loader2, Plus, Check } from "lucide-react";
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
  leaveConversation,
} from "@/lib/api/chat";
import { getContacts, ContactItem } from "@/lib/api/contact";

export interface ConversationListProps {
  activeId?: string;
  className?: string;
}

export function ConversationList({ activeId, className }: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
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

  const fetchConversations = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await getConversations(50, 0, token);
      if (res.items && res.items.length > 0) {
        const mapped: Conversation[] = res.items.map((item) => ({
          id: item.id,
          type: item.type,
          name: item.name || (item.type === "group" ? "Group Chat" : "Direct Chat"),
          avatar: item.avatar || undefined,
          members: item.member_ids,
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
          isOnline: item.members.some((m) => m.is_online),
        }));
        setConversations(mapped);
      } else {
        setConversations([]);
      }
    } catch (err: any) {
      console.warn("Could not fetch live conversations:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchContactsList = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await getContacts(token);
      setContacts(res.items || []);
    } catch (err: any) {
      console.warn("Could not fetch contacts for chat picker:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchContactsList();
  }, [fetchConversations, fetchContactsList]);

  const handleDeleteConversation = async (id: string) => {
    const token = getAuthToken();

    if (token && !id.startsWith("c1") && !id.startsWith("c2")) {
      try {
        await leaveConversation(id, token);
      } catch (err: any) {
        console.warn("Error leaving conversation:", err.message);
      }
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
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
      } catch (err: any) {
        alert(err.message || "Failed to start direct conversation");
      } finally {
        setIsCreating(false);
      }
    } else {
      setIsNewChatModalOpen(false);
      router.push("/app/chats/c1");
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedContactIds.length === 0) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      setIsCreating(true);
      const conv = await createGroupConversation(
        {
          name: groupName.trim(),
          member_ids: selectedContactIds,
        },
        token
      );
      setIsNewChatModalOpen(false);
      setGroupName("");
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

  const tabs = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: conversations.filter((c) => c.unreadCount > 0).length || undefined },
    { id: "groups", label: "Groups" },
    { id: "favorites", label: "Favorites" },
  ];

  const filteredConversations = conversations.filter((conv) => {
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

      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2">
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
          <div className="text-center py-12 px-4 text-xs text-[#66736D] dark:text-[#8E9C95]">
            No conversations found.
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
            <Input
              id="groupName"
              label="Group Name"
              placeholder="e.g. Project Alpha, Family, Core Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <div>
              <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-2">
                Select Participants ({selectedContactIds.length} selected)
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#E6EBE8] dark:border-[#212E29] rounded-xl p-2">
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
                    No contacts available to add.
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
                disabled={isCreating || !groupName.trim() || selectedContactIds.length === 0}
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
