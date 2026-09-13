"use client";

import React, { useState, useRef, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Message } from "@/types/message";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Loader2,
  Download,
  X as CloseIcon,
} from "lucide-react";
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markMessageAsRead,
} from "@/lib/api/message";
import {
  getConversationDetails,
  deleteConversation,
  clearConversationMessages,
  createOrGetDirectConversation,
  ConversationItem,
} from "@/lib/api/chat";
import { getUserPublicProfile } from "@/lib/api/user";
import { getStoredToken } from "@/lib/api/auth";
import {
  getContacts,
  getContactRequests,
  acceptContactRequest,
} from "@/lib/api/contact";
import { wsClient } from "@/lib/api";
import { GroupSettingsModal } from "@/components/chat/GroupSettingsModal";
import { uploadMedia } from "@/lib/api/media";

interface ConversationState {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
  type?: "direct" | "group";
}

export default function IndividualChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const conversationId = resolvedParams.conversationId;

  const [currentUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("fluxchat_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.id) return u.id;
        } catch {}
      }
      const token = getStoredToken();
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
    return "u_me";
  });

  const [conversation, setConversation] = useState<ConversationState>({
    id: conversationId,
    name: "Chat",
    type: "direct",
  });
  const [conversationItem, setConversationItem] = useState<ConversationItem | null>(null);

  const conversationRef = useRef(conversation);
  const otherUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Reply and Edit state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Lightbox & Group Settings Modals
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);

  // General section & pending connection request state
  const [isInGeneral, setIsInGeneral] = useState(false);
  const [pendingReceivedRequestId, setPendingReceivedRequestId] = useState<string | null>(null);
  const [isAcceptingInChat, setIsAcceptingInChat] = useState(false);

  // Deletion modals state
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Scroll management
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isMine = lastMsg && (lastMsg.senderId === currentUserId || lastMsg.senderId === "u_me");
    if (prevMessagesLengthRef.current === 0 || isMine || isAtBottomRef.current) {
      scrollToBottom(prevMessagesLengthRef.current > 0);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId]);

  // Fetch live conversation metadata and messages
  const fetchThreadData = useCallback(async (silent = false) => {
    const token = getStoredToken();
    if (!token) return;

    let otherUserId: string | null = null;
    let targetId = conversationId;

    let myUserId = currentUserId;
    if (!myUserId || myUserId === "u_me") {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.sub) myUserId = payload.sub;
        }
      } catch {}
    }

    // 1. Fetch conversation details
    if (conversationId.startsWith("c_")) {
      const recipientId = conversationId.replace(/^c_/, "");
      otherUserId = recipientId;
      otherUserIdRef.current = recipientId;
      try {
        const directConv = await createOrGetDirectConversation(recipientId, token);
        targetId = directConv.id;
        setConversationItem(directConv);
        setConversation({
          id: directConv.id,
          name: directConv.name || "Direct Chat",
          avatar: directConv.avatar || undefined,
          isOnline: directConv.members?.some((m: any) => m.is_online) || false,
          type: "direct",
        });
        // Transition URL to real conversation ID so socket events and routes match canonical thread
        router.replace(`/app/chats/${directConv.id}`);
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
          router.push("/login");
          return;
        }
        try {
          const publicProfile = await getUserPublicProfile(recipientId, token);
          setConversation({
            id: conversationId,
            name: publicProfile.name,
            avatar: publicProfile.avatar || undefined,
            isOnline: publicProfile.is_online,
            type: "direct",
          });
        } catch (e: any) {
          console.warn("Could not fetch recipient profile:", e.message);
        }
      }
    } else {
      try {
        const convDetails = await getConversationDetails(conversationId, token);
        setConversationItem(convDetails);
        if (convDetails.type === "direct") {
          const other = convDetails.members.find((m) => m.id !== myUserId);
          if (other) {
            otherUserId = other.id;
            otherUserIdRef.current = other.id;
          }
        }
        setConversation({
          id: convDetails.id,
          name: convDetails.name || (convDetails.type === "group" ? "Group Chat" : "Direct Chat"),
          avatar: convDetails.avatar || undefined,
          isOnline: convDetails.members.some((m) => m.is_online),
          type: convDetails.type,
        });
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
          router.push("/login");
          return;
        }
        console.warn("Could not fetch conversation details:", err.message);
      }
    }

    // Determine if conversation is in General section (pending connection)
    if (otherUserId && !silent) {
      try {
        const [contactsRes, requestsRes] = await Promise.all([
          getContacts(token).catch(() => ({ items: [] })),
          getContactRequests(token).catch(() => ({ received: [], sent: [] })),
        ]);
        const isConfirmed = (contactsRes.items || []).some(
          (c) => c.contact_id === otherUserId
        );
        if (!isConfirmed) {
          setIsInGeneral(true);
          const received = (requestsRes.received || []).find(
            (r) => r.sender_id === otherUserId
          );
          setPendingReceivedRequestId(received ? received.id : null);
        } else {
          setIsInGeneral(false);
          setPendingReceivedRequestId(null);
        }
      } catch (err) {
        console.warn("Could not check connection status for chat section:", err);
      }
    } else {
      setIsInGeneral(false);
      setPendingReceivedRequestId(null);
    }

    // 2. Fetch live messages (backed by Redis cache & DB)
    try {
      const res = await getMessages(targetId, 100, undefined, token);
      if (res.items && res.items.length > 0) {
        const mapped: Message[] = res.items.map((item) => {
          const isImg =
            item.type === "image" ||
            item.attachment?.type === "image" ||
            Boolean(item.attachment?.url && /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(item.attachment.url)) ||
            Boolean(item.attachment?.url?.includes("res.cloudinary.com") && !item.attachment?.url?.endsWith(".pdf"));

          return {
            id: item.id,
            conversationId: item.conversation_id,
            senderId: item.sender_id,
            senderName: item.sender_name || undefined,
            content: item.content,
            type: (isImg ? "image" : item.type) as "text" | "file" | "image",
            attachment: item.attachment
              ? {
                  name: item.attachment.name,
                  size: item.attachment.size,
                  type: (isImg ? "image" : "file") as "image" | "file",
                  url: item.attachment.url,
                }
              : undefined,
            replyTo: item.reply_to || undefined,
            edited: item.edited || false,
            createdAt: item.created_at
              ? new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Now",
            status: item.status,
          };
        });

        setMessages((prev) => {
          if (prev.length === 0) return mapped;
          const existingMap = new Map(prev.map((m) => [m.id, m]));
          for (const item of mapped) {
            if (existingMap.has(item.id)) {
              const existing = existingMap.get(item.id)!;
              if (
                item.status !== existing.status ||
                item.edited !== existing.edited ||
                item.content !== existing.content ||
                item.attachment?.url !== existing.attachment?.url
              ) {
                existingMap.set(item.id, {
                  ...existing,
                  status: item.status,
                  edited: item.edited,
                  content: item.content,
                  attachment: item.attachment,
                });
              }
            } else {
              existingMap.set(item.id, item);
            }
          }
          return Array.from(existingMap.values());
        });

        // Mark incoming unread messages as read
        for (const item of res.items) {
          if (item.sender_id !== myUserId && item.status !== "read") {
            markMessageAsRead(item.id, token).catch(() => {});
            wsClient.markMessageRead(
              item.id,
              targetId,
              item.sender_id ? [item.sender_id] : undefined
            );
          }
        }
      } else if (!silent) {
        setMessages([]);
      }
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("unauthorized")) {
        router.push("/login");
        return;
      }
      if (!silent) setMessages([]);
    }
  }, [conversationId, currentUserId, router]);

  useEffect(() => {
    fetchThreadData();

    // Establish WebSocket connection and listen for live events
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("fluxchat_access_token") || localStorage.getItem("accessToken")
        : null;

    if (token) {
      wsClient.connect(token);

      const handleNewMessage = (payload: any) => {
        const msgData = payload.data || payload;
        if (!msgData) return;

        const activeChatId = conversationRef.current.id;
        const recipientId = conversationId.startsWith("c_") ? conversationId.replace(/^c_/, "") : null;
        const currentOtherId = otherUserIdRef.current || recipientId;
        const matchesThread =
          msgData.conversation_id === conversationId ||
          msgData.conversation_id === activeChatId ||
          (currentOtherId && (msgData.sender_id === currentOtherId || msgData.recipient_id === currentOtherId));

        if (matchesThread) {
          const isImg =
            msgData.type === "image" ||
            msgData.attachment?.type === "image" ||
            Boolean(msgData.attachment?.url && /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(msgData.attachment.url)) ||
            Boolean(msgData.attachment?.url?.includes("res.cloudinary.com") && !msgData.attachment?.url?.endsWith(".pdf"));

          const incomingMsg: Message = {
            id: msgData.id,
            conversationId: msgData.conversation_id,
            senderId: msgData.sender_id,
            senderName: msgData.sender_name || undefined,
            content: msgData.content,
            type: (isImg ? "image" : msgData.type || "text") as "text" | "file" | "image",
            attachment: msgData.attachment
              ? {
                  name: msgData.attachment.name,
                  size: msgData.attachment.size,
                  type: (isImg ? "image" : "file") as "image" | "file",
                  url: msgData.attachment.url,
                }
              : undefined,
            replyTo: msgData.reply_to || undefined,
            edited: msgData.edited || false,
            createdAt: msgData.created_at
              ? new Date(msgData.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Now",
            status: msgData.status || "sent",
          };

          setMessages((prev) => {
            // If already present (or replaces optimistic temp message with same content)
            if (prev.some((m) => m.id === msgData.id)) {
              return prev.map((m) => (m.id === msgData.id ? incomingMsg : m));
            }
            // Replace matching temp message from current sender
            const tempIdx = prev.findIndex(
              (m) =>
                m.id.startsWith("temp_") &&
                m.senderId === incomingMsg.senderId &&
                m.content === incomingMsg.content
            );
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = incomingMsg;
              return updated;
            }
            return [...prev, incomingMsg];
          });

          if (msgData.sender_id !== currentUserId && token) {
            markMessageAsRead(msgData.id, token).catch(() => {});
            wsClient.markMessageRead(
              msgData.id,
              msgData.conversation_id || activeChatId,
              [msgData.sender_id]
            );
          }
        }
      };

      const handleUpdatedMessage = (payload: any) => {
        const msgData = payload.data || payload;
        if (!msgData) return;
        const activeChatId = conversationRef.current.id;
        if (msgData.conversation_id === conversationId || msgData.conversation_id === activeChatId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgData.id ? { ...m, content: msgData.content, edited: true } : m
            )
          );
        }
      };

      const handleDeletedMessage = (payload: any) => {
        const msgData = payload.data || payload;
        if (!msgData) return;
        const activeChatId = conversationRef.current.id;
        if (msgData.conversation_id === conversationId || msgData.conversation_id === activeChatId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgData.id
                ? { ...m, content: "This message was deleted" }
                : m
            )
          );
        }
      };

      const handleMessageRead = (payload: any) => {
        const data = payload.data || payload;
        if (!data) return;
        const activeChatId = conversationRef.current.id;
        if (data.conversation_id === conversationId || data.conversation_id === activeChatId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id ? { ...m, status: "read" } : m
            )
          );
        }
      };

      const handleTypingStart = (payload: any) => {
        const data = payload.data || payload;
        if (!data) return;
        const activeChatId = conversationRef.current.id;
        if (
          (data.conversation_id === conversationId || data.conversation_id === activeChatId) &&
          data.user_id !== currentUserId
        ) {
          setIsTyping(true);
        }
      };

      const handleTypingStop = (payload: any) => {
        const data = payload.data || payload;
        if (!data) return;
        const activeChatId = conversationRef.current.id;
        if (data.conversation_id === conversationId || data.conversation_id === activeChatId) {
          setIsTyping(false);
        }
      };

      const handleUserOnline = (payload: any) => {
        const data = payload.data || payload;
        if (!data || !data.user_id) return;
        if (data.user_id === otherUserIdRef.current) {
          setConversation((prev) => ({ ...prev, isOnline: true }));
        }
      };

      const handleUserOffline = (payload: any) => {
        const data = payload.data || payload;
        if (!data || !data.user_id) return;
        if (data.user_id === otherUserIdRef.current) {
          setConversation((prev) => ({ ...prev, isOnline: false }));
        }
      };

      const handleMessagesCleared = (payload: any) => {
        const data = payload.data || payload;
        if (!data) return;
        const activeChatId = conversationRef.current.id;
        if (data.conversation_id === conversationId || data.conversation_id === activeChatId) {
          setMessages([]);
          showToast("Chat history was cleared");
        }
      };

      const handleConversationDeleted = (payload: any) => {
        const data = payload.data || payload;
        if (!data) return;
        const activeChatId = conversationRef.current.id;
        if (data.conversation_id === conversationId || data.conversation_id === activeChatId) {
          router.push("/app/chats");
        }
      };

      wsClient.on("message.new", handleNewMessage);
      wsClient.on("message.updated", handleUpdatedMessage);
      wsClient.on("message.deleted", handleDeletedMessage);
      wsClient.on("message.read", handleMessageRead);
      wsClient.on("messages.cleared", handleMessagesCleared);
      wsClient.on("conversation.deleted", handleConversationDeleted);
      wsClient.on("typing.start", handleTypingStart);
      wsClient.on("typing.stop", handleTypingStop);
      wsClient.on("user.online", handleUserOnline);
      wsClient.on("user.offline", handleUserOffline);

      // Gentle polling fallback every 15 seconds to keep messages in sync if sockets drop
      const pollTimer = setInterval(async () => {
        const t = getStoredToken();
        if (!t) return;
        const currentTargetId = conversationRef.current.id || conversationId;
        if (currentTargetId && !currentTargetId.startsWith("c_")) {
          try {
            const res = await getMessages(currentTargetId, 50, undefined, t);
            if (res.items && res.items.length > 0) {
              const mapped: Message[] = res.items.map((item) => {
                const isImg =
                  item.type === "image" ||
                  item.attachment?.type === "image" ||
                  Boolean(item.attachment?.url && /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(item.attachment.url)) ||
                  Boolean(item.attachment?.url?.includes("res.cloudinary.com") && !item.attachment?.url?.endsWith(".pdf"));

                return {
                  id: item.id,
                  conversationId: item.conversation_id,
                  senderId: item.sender_id,
                  senderName: item.sender_name || undefined,
                  content: item.content,
                  type: (isImg ? "image" : item.type) as "text" | "file" | "image",
                  attachment: item.attachment
                    ? {
                        name: item.attachment.name,
                        size: item.attachment.size,
                        type: (isImg ? "image" : "file") as "image" | "file",
                        url: item.attachment.url,
                      }
                    : undefined,
                  replyTo: item.reply_to || undefined,
                  edited: item.edited || false,
                  createdAt: item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Now",
                  status: item.status || "sent",
                };
              });

              setMessages((prev) => {
                const existingMap = new Map(prev.map((m) => [m.id, m]));
                for (const item of mapped) {
                  if (existingMap.has(item.id)) {
                    const existing = existingMap.get(item.id)!;
                    if (
                      item.status !== existing.status ||
                      item.edited !== existing.edited ||
                      item.content !== existing.content ||
                      item.attachment?.url !== existing.attachment?.url
                    ) {
                      existingMap.set(item.id, {
                        ...existing,
                        status: item.status,
                        edited: item.edited,
                        content: item.content,
                        attachment: item.attachment,
                      });
                    }
                  } else {
                    existingMap.set(item.id, item);
                  }
                }
                return Array.from(existingMap.values());
              });
            }
          } catch {}
        }
      }, 15000);

      return () => {
        wsClient.off("message.new", handleNewMessage);
        wsClient.off("message.updated", handleUpdatedMessage);
        wsClient.off("message.deleted", handleDeletedMessage);
        wsClient.off("message.read", handleMessageRead);
        wsClient.off("messages.cleared", handleMessagesCleared);
        wsClient.off("conversation.deleted", handleConversationDeleted);
        wsClient.off("typing.start", handleTypingStart);
        wsClient.off("typing.stop", handleTypingStop);
        wsClient.off("user.online", handleUserOnline);
        wsClient.off("user.offline", handleUserOffline);
        clearInterval(pollTimer);
      };
    }
  }, [fetchThreadData, conversationId, currentUserId, router]);

  // Instant optimistic send for text messages
  const handleSendMessage = async (content: string, replyToId?: string) => {
    const token = getStoredToken();
    if (!token) return;

    let targetConvId = conversation.id;
    if (targetConvId.startsWith("c_")) {
      const recipientId = targetConvId.replace(/^c_/, "");
      try {
        const directConv = await createOrGetDirectConversation(recipientId, token);
        targetConvId = directConv.id;
        setConversation((prev) => ({ ...prev, id: directConv.id }));
      } catch (err: any) {
        showToast(err.message || "Could not open conversation", "error");
        return;
      }
    }

    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: targetConvId,
      senderId: currentUserId,
      senderName: "You",
      content: content.trim(),
      type: "text",
      replyTo: replyToId,
      edited: false,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyingTo(null);

    try {
      const created = await sendMessage(
        targetConvId,
        {
          content: content.trim(),
          type: "text",
          reply_to: replyToId,
        },
        token
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: created.id,
                status: created.status,
                createdAt: created.created_at
                  ? new Date(created.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : m.createdAt,
              }
            : m
        )
      );
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || "";
      if ((errMsg.includes("404") || errMsg.includes("not found")) && otherUserIdRef.current) {
        try {
          const directConv = await createOrGetDirectConversation(otherUserIdRef.current, token);
          setConversation((prev) => ({ ...prev, id: directConv.id }));
          router.replace(`/app/chats/${directConv.id}`);
          const retried = await sendMessage(
            directConv.id,
            {
              content: content.trim(),
              type: "text",
              reply_to: replyToId,
            },
            token
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: retried.id,
                    conversationId: retried.conversation_id,
                    status: retried.status,
                  }
                : m
            )
          );
          return;
        } catch (retryErr: any) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          showToast(retryErr.message || "Failed to send message", "error");
          return;
        }
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast(err.message || "Failed to send message", "error");
    }
  };

  // Upload file to Cloudinary & instantly render in chat
  const handleSendFile = async (file: File) => {
    const token = getStoredToken();
    if (!token) return;

    let targetConvId = conversation.id;
    if (targetConvId.startsWith("c_")) {
      const recipientId = targetConvId.replace(/^c_/, "");
      try {
        const directConv = await createOrGetDirectConversation(recipientId, token);
        targetConvId = directConv.id;
        setConversation((prev) => ({ ...prev, id: directConv.id }));
      } catch (err: any) {
        showToast(err.message || "Could not open conversation", "error");
        return;
      }
    }

    const isImage = file.type.startsWith("image/");
    const fileSizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const localPreviewUrl = isImage ? URL.createObjectURL(file) : undefined;
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const optimisticMsg: Message = {
      id: tempId,
      conversationId: targetConvId,
      senderId: currentUserId,
      senderName: "You",
      content: isImage ? "Photo" : file.name,
      type: isImage ? "image" : "file",
      attachment: {
        name: file.name,
        size: fileSizeStr,
        type: isImage ? "image" : "file",
        url: localPreviewUrl,
      },
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setIsUploadingAttachment(true);

    try {
      const mediaRes = await uploadMedia(file, "fluxchat/chat", token);
      const mediaUrl = mediaRes.url;

      const created = await sendMessage(
        targetConvId,
        {
          content: isImage ? "Photo" : file.name,
          type: isImage ? "image" : "file",
          attachment: {
            name: file.name,
            size: fileSizeStr,
            url: mediaUrl,
            type: isImage ? "image" : "file",
          },
        },
        token
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: created.id,
                status: created.status,
                attachment: {
                  ...m.attachment!,
                  url: mediaUrl,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast(err.message || "Failed to upload and send file", "error");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSaveEdit = async (id: string, newContent: string) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      await editMessage(id, newContent.trim(), token);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: newContent.trim(), edited: true } : m
        )
      );
      setEditingMessage(null);
      showToast("Message updated", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to edit message", "error");
    }
  };

  const handleTyping = (typing: boolean) => {
    const targetId = conversationRef.current.id || conversationId;
    const recipientId =
      otherUserIdRef.current ||
      (conversationId.startsWith("c_") ? conversationId.replace(/^c_/, "") : undefined);
    wsClient.sendTyping(targetId, typing, recipientId ? [recipientId] : undefined);
  };

  const handleDeleteMessage = async (id: string) => {
    const token = getStoredToken();
    const targetMsg = messages.find((m) => m.id === id);
    const isAuthor =
      targetMsg &&
      (targetMsg.senderId === currentUserId || targetMsg.senderId === "u_me");

    if (isAuthor && token) {
      try {
        await deleteMessage(id, token);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, content: "This message was deleted" } : m
          )
        );
        showToast("Message deleted for everyone");
      } catch (err: any) {
        showToast(err.message || "Failed to delete message", "error");
      }
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      showToast("Message removed");
    }
  };

  // Permanently clear messages and purge from DB & cache
  const handleConfirmClearMessages = async () => {
    const token = getStoredToken();
    const targetId = conversationRef.current.id || conversationId;
    if (token && targetId) {
      try {
        await clearConversationMessages(targetId, token);
      } catch (err: any) {
        console.warn("Could not clear messages on backend:", err.message);
      }
    }
    setMessages([]);
    setIsClearModalOpen(false);
    showToast("Chat history cleared permanently", "success");
  };

  // Permanently delete conversation, purge all messages and stored contact data
  const handleConfirmDeleteChat = async () => {
    const token = getStoredToken();
    const targetId = conversationRef.current.id || conversationId;
    if (token && targetId) {
      try {
        await deleteConversation(targetId, token);
      } catch (err: any) {
        console.warn("Could not delete conversation on backend:", err.message);
      }
    }
    setIsDeleteChatModalOpen(false);
    showToast("Conversation and data permanently purged", "success");
    router.push("/app/chats");
  };

  const handleAcceptInChat = async () => {
    if (!pendingReceivedRequestId) return;
    const token = getStoredToken();
    if (!token) return;

    try {
      setIsAcceptingInChat(true);
      await acceptContactRequest(pendingReceivedRequestId, token);
      setIsInGeneral(false);
      setPendingReceivedRequestId(null);
      showToast("Connection accepted! Chat moved to Primary.", "success");
      fetchThreadData();
    } catch (err: any) {
      showToast(err.message || "Failed to accept connection request", "error");
    } finally {
      setIsAcceptingInChat(false);
    }
  };

  const isGroup = conversation.type === "group";
  const pendingRequestsCount = conversationItem?.join_requests?.length || 0;

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
          isGroup={isGroup}
          pendingRequestsCount={pendingRequestsCount}
          onOpenGroupSettings={() => setIsGroupSettingsOpen(true)}
          onClearMessages={() => setIsClearModalOpen(true)}
          onDeleteConversation={() => setIsDeleteChatModalOpen(true)}
        />

        {/* General Section & Pending Connection Banner */}
        {isInGeneral && (
          <div className="animate-in fade-in border-b border-[#E6EBE8] dark:border-[#212E29]">
            {pendingReceivedRequestId ? (
              <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">
                    <strong>{conversation.name}</strong> sent you a connection request. Accept to move this chat to <strong>Primary</strong>.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleAcceptInChat}
                  disabled={isAcceptingInChat}
                  leftIcon={
                    isAcceptingInChat ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )
                  }
                >
                  Accept Request
                </Button>
              </div>
            ) : (
              <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    <strong>Connection Request Pending</strong> • This conversation is currently in your <strong>General</strong> section. Once accepted, it will automatically move to <strong>Primary</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message Thread Scroll Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2"
        >
          {/* Subtle date pill */}
          <div className="text-center my-3">
            <span className="px-3 py-1 rounded-full bg-[#F4F6F5] dark:bg-[#1D2723] text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95] select-none">
              Today
            </span>
          </div>

          {messages.length > 0 ? (
            messages.map((message) => {
              const repliedMsg = message.replyTo
                ? messages.find((m) => m.id === message.replyTo)
                : undefined;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMe={
                    message.senderId === currentUserId ||
                    message.senderId === "u_me"
                  }
                  repliedMessage={repliedMsg}
                  onReply={(msg) => {
                    setEditingMessage(null);
                    setReplyingTo(msg);
                  }}
                  onEdit={(msg) => {
                    setReplyingTo(null);
                    setEditingMessage(msg);
                  }}
                  onDelete={handleDeleteMessage}
                  onImageClick={(url, name) => setLightboxImage({ url, name })}
                />
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-[#66736D] dark:text-[#8E9C95] space-y-1">
              <p className="font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                No messages here yet
              </p>
              <p>Send a message below to start the conversation.</p>
            </div>
          )}

          {isTyping && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-2xl bg-[#F4F6F5] dark:bg-[#1D2723] w-fit text-xs text-[#66736D] dark:text-[#8E9C95] animate-pulse">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              </span>
              <span>{conversation.name} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          isUploadingAttachment={isUploadingAttachment}
          onTyping={handleTyping}
          replyingTo={
            replyingTo
              ? {
                  id: replyingTo.id,
                  senderName:
                    replyingTo.senderId === currentUserId ? "You" : conversation.name,
                  content: replyingTo.content,
                }
              : null
          }
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={
            editingMessage
              ? {
                  id: editingMessage.id,
                  content: editingMessage.content,
                }
              : null
          }
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={handleSaveEdit}
        />
      </div>

      {/* Interactive Full-Screen Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage.url}
              download={lightboxImage.name || "image"}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm cursor-pointer"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm cursor-pointer"
              title="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
          <div
            className="max-w-4xl max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name || "Enlarged photo"}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
          {lightboxImage.name && (
            <div className="mt-3 text-white/80 text-sm font-medium">
              {lightboxImage.name}
            </div>
          )}
        </div>
      )}

      {/* Group Info & Admin Settings Modal */}
      {isGroup && conversationItem && (
        <GroupSettingsModal
          isOpen={isGroupSettingsOpen}
          onClose={() => setIsGroupSettingsOpen(false)}
          conversation={conversationItem}
          currentUserId={currentUserId}
          onConversationUpdated={(updated) => {
            setConversationItem(updated);
            setConversation((prev) => ({
              ...prev,
              name: updated.name || prev.name,
              avatar: updated.avatar || undefined,
            }));
            fetchThreadData(true);
          }}
        />
      )}

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
                This will delete all messages in this conversation for you and purge them from the database. This action cannot be undone.
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
                This will permanently delete all previous stored data, messages, media, and attachments for this contact so no old data ever resurfaces.
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
