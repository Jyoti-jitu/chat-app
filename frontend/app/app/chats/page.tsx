"use client";

import React, { useState } from "react";
import { ConversationList } from "@/components/chat/ConversationList";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { mockUsers } from "@/lib/mock/users";
import { useRouter } from "next/navigation";

export default function ChatsPage() {
  const router = useRouter();
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Conversation List Sidebar */}
      <ConversationList />

      {/* Empty Chat State on Desktop (Hidden on small mobile screens) */}
      <div className="hidden sm:flex flex-1 h-full overflow-hidden">
        <EmptyChat onNewChat={() => setIsNewChatModalOpen(true)} />
      </div>

      {/* New Chat Modal */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        title="Start a new conversation"
        description="Choose someone from your contacts to message"
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
