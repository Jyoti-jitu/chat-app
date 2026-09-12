"use client";

import React, { useState, useEffect } from "react";
import { ConversationList } from "@/components/chat/ConversationList";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/api/auth";
import { getContacts } from "@/lib/api/contact";
import { User } from "@/types/user";

export default function ChatsPage() {
  const router = useRouter();
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  useEffect(() => {
    if (isNewChatModalOpen) {
      const token = getStoredToken();
      if (token) {
        setIsLoadingContacts(true);
        getContacts(token)
          .then((res) => {
            if (res.items) {
              setContacts(
                res.items.map((item) => ({
                  id: item.contact_id,
                  name: item.user.name,
                  username: item.user.username,
                  email: `${item.user.username}@fluxchat.io`,
                  avatar: item.user.avatar || undefined,
                  isOnline: item.user.is_online,
                }))
              );
            }
          })
          .catch(() => setContacts([]))
          .finally(() => setIsLoadingContacts(false));
      }
    }
  }, [isNewChatModalOpen]);

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
          {isLoadingContacts ? (
            <div className="text-center py-6 text-xs text-[#66736D] dark:text-[#8E9C95]">
              Loading contacts...
            </div>
          ) : contacts.length > 0 ? (
            contacts.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  router.push(`/app/chats/c_${user.id}`);
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
            ))
          ) : (
            <div className="text-center py-8 text-xs text-[#66736D] dark:text-[#8E9C95]">
              <p className="font-semibold mb-1">No contacts yet</p>
              <p className="mb-3 text-[11px]">Add contacts to start chatting with them.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  router.push("/app/contacts");
                }}
              >
                Go to Contacts
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
