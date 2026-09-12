"use client";

import React, { useState } from "react";
import { UserCheck, UserX, Clock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { mockRequests } from "@/lib/mock/requests";
import { ConnectionRequest } from "@/types/request";

export default function RequestsPage() {
  const [requests, setRequests] = useState<ConnectionRequest[]>(mockRequests);
  const [activeTab, setActiveTab] = useState("received");

  const receivedRequests = requests.filter((r) => r.type === "received");
  const sentRequests = requests.filter((r) => r.type === "sent");

  const tabs = [
    { id: "received", label: "Received", count: receivedRequests.length },
    { id: "sent", label: "Sent", count: sentRequests.length },
  ];

  const handleAccept = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReject = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCancelSent = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29]">
        <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Connection Requests
        </h1>
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
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] shadow-xs"
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
                      <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                        Received {req.timestamp}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(req.id)}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReject(req.id)}
                      leftIcon={<UserX className="w-3.5 h-3.5" />}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-[#66736D] dark:text-[#8E9C95]">
                No pending requests in your queue.
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
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] shadow-xs"
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
                        <Clock className="w-3 h-3" />
                        <span>Pending acceptance • Sent {req.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelSent(req.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-[#66736D] dark:text-[#8E9C95]">
                You haven&apos;t sent any connection requests recently.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
