"use client";

import React, { useState, useRef, useEffect, useCallback, use } from "react";
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
import { Trash2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getMessages,
  sendMessage,
  deleteMessage,
  markMessageAsRead,
} from "@/lib/api/message";
import { getConversationDetails, leaveConversation } from "@/lib/api/chat";

export default function IndividualChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const conversationId = resolvedParams.conversationId;

  const [currentUserId, setCurrentUserId] = useState<string>("u_me");
  const [conversation, setConversation] = useState<{
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
  }>(() => {
    const fallback =
      mockConversations.find((c) => c.id === conversationId) || mockConversations[0];
    return {
      id: fallback.id,
      name: fallback.name,
      avatar: fallback.avatar,
      isOnline: fallback.isOnline,
    };
  });

  const [messages, setMessages] = useState<Message[]>(
    initialMessages[conversationId] || initialMessages["c1"] || []
  );

  // Deletion modals state
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Decode current user ID from token
  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.sub) setCurrentUserId(payload.sub);
        }
      } catch (e) {
        console.warn("Could not decode user token sub:", e);
      }
    }
  }, []);

  // Fetch live conversation metadata and messages
  const fetchThreadData = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    // 1. Fetch conversation details
    if (!conversationId.startsWith("c1") && !conversationId.startsWith("c2") && !conversationId.startsWith("c3")) {
      try {
        const convDetails = await getConversationDetails(conversationId, token);
        setConversation({
          id: convDetails.id,
          name: convDetails.name || (convDetails.type === "group" ? "Group Chat" : "Direct Chat"),
          avatar: convDetails.avatar || undefined,
          isOnline: convDetails.members.some((m) => m.is_online),
        });
      } catch (err: any) {
        console.warn("Could not fetch conversation details:", err.message);
      }
    }

    // 2. Fetch live messages
    try {
      const res = await getMessages(conversationId, 100, undefined, token);
      if (res.items && res.items.length > 0) {
        const mapped: Message[] = res.items.map((item) => ({
          id: item.id,
          conversationId: item.conversation_id,
          senderId: item.sender_id,
          content: item.content,
          type: item.type as "text" | "file",
          attachment: item.attachment
            ? {
                name: item.attachment.name,
                size: item.attachment.size,
                type: "file",
              }
            : undefined,
          createdAt: item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Now",
          status: item.status,
        }));
        setMessages(mapped);

        // Mark incoming unread messages as read
        for (const item of res.items) {
          if (item.sender_id !== currentUserId && item.status !== "read") {
            markMessageAsRead(item.id, token).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.warn("Using fallback messages for conversation:", err.message);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    fetchThreadData();
  }, [fetchThreadData]);

  const handleSendMessage = async (content: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !conversationId.startsWith("c1") && !conversationId.startsWith("c2")) {
      try {
        const created = await sendMessage(
          conversationId,
          { content: content.trim(), type: "text" },
          token
        );
        const newMsg: Message = {
          id: created.id,
          conversationId: created.conversation_id,
          senderId: created.sender_id,
          content: created.content,
          type: "text",
          createdAt: created.created_at
            ? new Date(created.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Now",
          status: created.status,
        };
        setMessages((prev) => [...prev, newMsg]);
      } catch (err: any) {
        showToast(err.message || "Failed to send message", "error");
      }
    } else {
      // Local demo fallback
      const newMessage: Message = {
        id: `m_${Date.now()}`,
        conversationId: conversation.id,
        senderId: currentUserId,
        content,
        type: "text",
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: "delivered",
      };

      setMessages((prev) => [...prev, newMessage]);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: "read" } : msg
          )
        );
      }, 1200);
    }
  };

  const handleSendAttachment = async (file: {
    name: string;
    size: string;
    type: "file";
  }) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !conversationId.startsWith("c1") && !conversationId.startsWith("c2")) {
      try {
        const created = await sendMessage(
          conversationId,
          {
            content: file.name,
            type: "file",
            attachment: {
              name: file.name,
              size: file.size,
              url: "#",
              type: "file",
            },
          },
          token
        );
        const newMsg: Message = {
          id: created.id,
          conversationId: created.conversation_id,
          senderId: created.sender_id,
          content: created.content,
          type: "file",
          attachment: {
            name: file.name,
            size: file.size,
            type: "file",
          },
          createdAt: created.created_at
            ? new Date(created.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Now",
          status: created.status,
        };
        setMessages((prev) => [...prev, newMsg]);
      } catch (err: any) {
        showToast(err.message || "Failed to upload file", "error");
      }
    } else {
      const attachmentMessage: Message = {
        id: `m_${Date.now()}`,
        conversationId: conversation.id,
        senderId: currentUserId,
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
    }
  };

  const handleDeleteMessage = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !id.startsWith("m_")) {
      try {
        await deleteMessage(id, token);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, content: "This message was deleted" }
              : m
          )
        );
        showToast("Message deleted");
      } catch (err: any) {
        showToast(err.message || "Failed to delete message", "error");
      }
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      showToast("Message deleted");
    }
  };

  const handleConfirmClearMessages = () => {
    setMessages([]);
    setIsClearModalOpen(false);
    showToast("Chat history cleared");
  };

  const handleConfirmDeleteChat = async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token && !conversationId.startsWith("c1") && !conversationId.startsWith("c2")) {
      try {
        await leaveConversation(conversationId, token);
      } catch (err: any) {
        console.warn("Could not leave conversation on backend:", err.message);
      }
    }
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
          <div
            className={`absolute top-20 right-6 z-40 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-flux-md animate-in fade-in ${
              toastType === "error"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                : "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20"
            }`}
          >
            {toastType === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
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
                isMe={
                  message.senderId === currentUserId ||
                  message.senderId === "u_me"
                }
                onDelete={handleDeleteMessage}
              />
            ))
          ) : (
            <div className="p-8 text-center text-xs text-[#66736D] dark:text-[#8E9C95] space-y-1">
              <p className="font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                No messages here yet
              </p>
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
