"use client";

import React, { useState } from "react";
import { Search, SquarePen } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { ConversationItem } from "./ConversationItem";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { mockConversations } from "@/lib/mock/conversations";
import { mockUsers } from "@/lib/mock/users";
import { Conversation } from "@/types/conversation";
import { useRouter } from "next/navigation";

export interface ConversationListProps {
  activeId?: string;
  className?: string;
}

export function ConversationList({ activeId, className }: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      router.push("/app/chats");
    }
  };

  const tabs = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: 1 },
    { id: "groups", label: "Groups" },
    { id: "favorites", label: "Favorites" },
  ];

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = conv.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

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
          onClick={() => setIsNewChatModalOpen(true)}
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
        {filteredConversations.length > 0 ? (
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
            No conversations found in this view.
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        title="Start a new conversation"
        description="Select a contact to message"
      >
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {mockUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => {
                setIsNewChatModalOpen(false);
                router.push("/app/chats/c1");
              }}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="sm" isOnline={user.isOnline} />
                <div className="text-left">
                  <div className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3]">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                    @{user.username}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm">
                Message
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
