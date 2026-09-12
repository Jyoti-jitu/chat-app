"use client";

import React, { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { mockConversations } from "@/lib/mock/conversations";
import { initialMessages } from "@/lib/mock/messages";
import { Message } from "@/types/message";
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function IndividualChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const conversationId = resolvedParams.conversationId;

  const conversation =
    mockConversations.find((c) => c.id === conversationId) ||
    mockConversations[0];

  const [messages, setMessages] = useState<Message[]>(
    initialMessages[conversationId] || initialMessages["c1"] || []
  );

  // Deletion modals state
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: `m_${Date.now()}`,
      conversationId: conversation.id,
      senderId: "u_me",
      content,
      type: "text",
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "delivered",
    };

    setMessages((prev) => [...prev, newMessage]);

    // Mock auto-read receipt update after 1 second
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: "read" } : msg
        )
      );
    }, 1200);
  };

  const handleSendAttachment = (file: { name: string; size: string; type: "file" }) => {
    const attachmentMessage: Message = {
      id: `m_${Date.now()}`,
      conversationId: conversation.id,
      senderId: "u_me",
      content: "Shared a project file",
      type: "file",
      attachment: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "delivered",
    };
    setMessages((prev) => [...prev, attachmentMessage]);
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setToastMessage("Message deleted");
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleConfirmClearMessages = () => {
    setMessages([]);
    setIsClearModalOpen(false);
    setToastMessage("Chat history cleared");
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleConfirmDeleteChat = () => {
    setIsDeleteChatModalOpen(false);
    router.push("/app/chats");
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Conversation List (Hidden on mobile screen) */}
      <ConversationList
        activeId={conversation.id}
        className="hidden sm:flex"
      />

      {/* Main Chat Area (Full width on mobile) */}
      <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors relative">
        {/* Toast notification */}
        {toastMessage && (
          <div className="absolute top-20 right-6 z-40 p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold flex items-center gap-2 shadow-flux-md animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Chat Header */}
        <ChatHeader
          name={conversation.name}
          avatar={conversation.avatar}
          isOnline={conversation.isOnline}
          onClearMessages={() => setIsClearModalOpen(true)}
          onDeleteConversation={() => setIsDeleteChatModalOpen(true)}
        />

        {/* Message Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          {/* Subtle date pill */}
          <div className="text-center my-3">
            <span className="px-3 py-1 rounded-full bg-[#F4F6F5] dark:bg-[#1D2723] text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95] select-none">
              Today
            </span>
          </div>

          {messages.length > 0 ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMe={message.senderId === "u_me"}
                onDelete={handleDeleteMessage}
              />
            ))
          ) : (
            <div className="p-8 text-center text-xs text-[#66736D] dark:text-[#8E9C95] space-y-1">
              <p className="font-semibold text-[#17211D] dark:text-[#F1F5F3]">No messages here yet</p>
              <p>Send a message below to start the conversation.</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendAttachment={handleSendAttachment}
        />
      </div>

      {/* Clear Messages Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Chat History"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Clear all messages?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                This will delete all messages in this conversation for you. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmClearMessages}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Conversation Confirmation Modal */}
      <Modal
        isOpen={isDeleteChatModalOpen}
        onClose={() => setIsDeleteChatModalOpen(false)}
        title="Delete Conversation"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Delete chat with {conversation.name}?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                This will completely remove this conversation from your chat list and delete all media and attachments.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteChatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDeleteChat}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Chat</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
