"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ConnectionRequest } from "@/types/request";
import { getStoredToken } from "@/lib/api/auth";
import {
  getContactRequests,
  acceptContactRequest,
  rejectContactRequest,
  cancelContactRequest,
} from "@/lib/api/contact";
import { wsClient } from "@/lib/api/websocket";

export default function RequestsPage() {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [activeTab, setActiveTab] = useState("received");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const fetchRequests = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await getContactRequests(token);

      const mappedReceived: ConnectionRequest[] = (res.received || []).map((r) => ({
        id: r.id,
        user: {
          id: r.sender?.id || r.sender_id,
          name: r.sender?.name || "FluxChat User",
          username: r.sender?.username || "user",
          email: `${r.sender?.username || "user"}@fluxchat.io`,
          avatar: r.sender?.avatar || undefined,
          isOnline: r.sender?.is_online || false,
          bio: r.sender?.bio || undefined,
        },
        type: "received",
        status: "pending",
        timestamp: r.created_at
          ? new Date(r.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Recently",
      }));

      const mappedSent: ConnectionRequest[] = (res.sent || []).map((r) => ({
        id: r.id,
        user: {
          id: r.recipient?.id || r.recipient_id,
          name: r.recipient?.name || "FluxChat User",
          username: r.recipient?.username || "user",
          email: `${r.recipient?.username || "user"}@fluxchat.io`,
          avatar: r.recipient?.avatar || undefined,
          isOnline: r.recipient?.is_online || false,
          bio: r.recipient?.bio || undefined,
        },
        type: "sent",
        status: "pending",
        timestamp: r.created_at
          ? new Date(r.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Recently",
      }));

      setRequests([...mappedReceived, ...mappedSent]);
    } catch (err: any) {
      console.warn("Could not load live requests from user-service:", err.message);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    const handleNewNotification = (payload: any) => {
      const data = payload?.data || payload;
      if (data?.type === "request" || data?.category === "requests") {
        fetchRequests();
      }
    };

    wsClient.on("notification.new", handleNewNotification);
    window.addEventListener("fluxchat:requests_updated", fetchRequests);

    return () => {
      wsClient.off("notification.new", handleNewNotification);
      window.removeEventListener("fluxchat:requests_updated", fetchRequests);
    };
  }, [fetchRequests]);

  const receivedRequests = requests.filter((r) => r.type === "received");
  const sentRequests = requests.filter((r) => r.type === "sent");

  const tabs = [
    { id: "received", label: "Received", count: receivedRequests.length },
    { id: "sent", label: "Sent", count: sentRequests.length },
  ];

  const handleAccept = async (id: string, userName: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !id.startsWith("req_")) {
      try {
        setActionLoadingId(id);
        await acceptContactRequest(id, token);
        setRequests((prev) => prev.filter((r) => r.id !== id));
        showToast(`Connected with ${userName}!`, "success");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
        }
      } catch (err: any) {
        showToast(err.message || "Failed to accept connection request", "error");
      } finally {
        setActionLoadingId(null);
      }
    } else {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast(`Connected with ${userName}!`, "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
      }
    }
  };

  const handleReject = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !id.startsWith("req_")) {
      try {
        setActionLoadingId(id);
        await rejectContactRequest(id, token);
        setRequests((prev) => prev.filter((r) => r.id !== id));
        showToast("Request declined.");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
        }
      } catch (err: any) {
        showToast(err.message || "Failed to decline request", "error");
      } finally {
        setActionLoadingId(null);
      }
    } else {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast("Request declined.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
      }
    }
  };

  const handleCancelSent = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    if (token && !id.startsWith("req_")) {
      try {
        setActionLoadingId(id);
        await cancelContactRequest(id, token);
        setRequests((prev) => prev.filter((r) => r.id !== id));
        showToast("Request cancelled.");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
        }
      } catch (err: any) {
        showToast(err.message || "Failed to cancel request", "error");
      } finally {
        setActionLoadingId(null);
      }
    } else {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast("Request cancelled.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fluxchat:requests_updated"));
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors relative">
      {/* Toast Notification */}
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

      {/* Header */}
      <div className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
            Connection Requests
          </h1>
          <button
            onClick={fetchRequests}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#66736D] hover:text-[#168F67] hover:bg-[#F7F9F8] dark:hover:bg-[#151D1A] transition-colors"
            title="Refresh requests"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-[#168F67]" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full flex-1 overflow-y-auto space-y-6">
        {/* Tabs */}
        <div className="border-b border-[#E6EBE8] dark:border-[#212E29] pb-3">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="underlined"
          />
        </div>

        {/* Received Tab Content */}
        {activeTab === "received" && (
          <div className="space-y-3">
            {receivedRequests.length > 0 ? (
              receivedRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] shadow-xs hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      name={req.user.name}
                      src={req.user.avatar}
                      size="lg"
                      isOnline={req.user.isOnline}
                    />
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                        {req.user.name}
                      </h3>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                        @{req.user.username}
                        {req.mutualFriends ? ` • ${req.mutualFriends} mutual connections` : ""}
                      </p>
                      {req.user.bio && (
                        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate mt-0.5 max-w-sm">
                          {req.user.bio}
                        </p>
                      )}
                      <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                        Received {req.timestamp}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(req.id, req.user.name)}
                      disabled={actionLoadingId === req.id}
                      leftIcon={
                        actionLoadingId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReject(req.id)}
                      disabled={actionLoadingId === req.id}
                      leftIcon={<UserX className="w-3.5 h-3.5" />}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29] rounded-2xl">
                {isLoading ? "Loading requests..." : "No pending requests in your queue."}
              </div>
            )}
          </div>
        )}

        {/* Sent Tab Content */}
        {activeTab === "sent" && (
          <div className="space-y-3">
            {sentRequests.length > 0 ? (
              sentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] shadow-xs hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      name={req.user.name}
                      src={req.user.avatar}
                      size="lg"
                    />
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                        {req.user.name}
                      </h3>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                        @{req.user.username}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Pending acceptance • Sent {req.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelSent(req.id)}
                    disabled={actionLoadingId === req.id}
                  >
                    {actionLoadingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Cancel"
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29] rounded-2xl">
                {isLoading ? "Loading requests..." : "You haven't sent any connection requests recently."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
