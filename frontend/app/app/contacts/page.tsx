"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Phone,
  Video,
  MessageSquare,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
  Clock,
  UserCheck,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { User } from "@/types/user";
import { getStoredToken } from "@/lib/api/auth";
import { searchUsers } from "@/lib/api/user";
import {
  getContacts,
  deleteContact,
  sendContactRequest,
  getContactRequests,
  acceptContactRequest,
} from "@/lib/api/contact";

export default function ContactsPage() {
  // Tabs: "directory" (All Registered Users) | "contacts" (My Confirmed Contacts)
  const [activeTab, setActiveTab] = useState<string>("directory");

  // State
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [pendingSentRecipientIds, setPendingSentRecipientIds] = useState<Set<string>>(new Set());
  const [pendingReceivedMap, setPendingReceivedMap] = useState<Map<string, string>>(new Map()); // senderId -> requestId
  const [contactIds, setContactIds] = useState<Set<string>>(new Set());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "available" | "pending" | "connected">("all");

  // Loading & Action states
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [acceptingUserId, setAcceptingUserId] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals & Toast
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContactIdentifier, setNewContactIdentifier] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Main data loader
  const loadAllData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setRegisteredUsers([]);
      setContacts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Parallel fetch: Confirmed contacts, All registered users, and Connection requests
      const [contactsRes, usersRes, requestsRes] = await Promise.all([
        getContacts(token).catch(() => ({ items: [], total: 0 })),
        searchUsers("", 100, token).catch(() => ({ items: [], total: 0, query: "" })),
        getContactRequests(token).catch(() => ({ received: [], sent: [] })),
      ]);

      // 1. Process confirmed contacts
      const mappedContacts: User[] = (contactsRes.items || []).map((item) => ({
        id: item.contact_id,
        name: item.user.name,
        username: item.user.username,
        email: `${item.user.username}@fluxchat.io`,
        phone: item.user.phone || undefined,
        avatar: item.user.avatar || undefined,
        bio: item.user.bio || undefined,
        isOnline: item.user.is_online,
        lastSeen: item.user.last_seen
          ? new Date(item.user.last_seen).toLocaleDateString()
          : "Offline",
      }));
      setContacts(mappedContacts);
      const cIdSet = new Set(mappedContacts.map((c) => c.id));
      setContactIds(cIdSet);

      // 2. Process pending connection requests
      const sentIds = new Set<string>((requestsRes.sent || []).map((r) => r.recipient_id));
      setPendingSentRecipientIds(sentIds);

      const receivedMap = new Map<string, string>();
      (requestsRes.received || []).forEach((r) => {
        receivedMap.set(r.sender_id, r.id);
      });
      setPendingReceivedMap(receivedMap);

      // 3. Process all registered users
      const mappedUsers: User[] = (usersRes.items || []).map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: `${u.username}@fluxchat.io`,
        phone: u.phone || undefined,
        avatar: u.avatar || undefined,
        bio: u.bio || undefined,
        isOnline: u.is_online,
        lastSeen: u.last_seen
          ? new Date(u.last_seen).toLocaleDateString()
          : "Offline",
      }));
      setRegisteredUsers(mappedUsers);
    } catch (err: any) {
      console.warn("Failed to load contacts directory:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Debounced server search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      const token = getStoredToken();
      if (!token) return;

      try {
        setIsSearchingServer(true);
        const searchRes = await searchUsers(searchQuery.trim(), 50, token);
        const serverResults: User[] = (searchRes.items || []).map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: `${u.username}@fluxchat.io`,
          phone: u.phone || undefined,
          avatar: u.avatar || undefined,
          bio: u.bio || undefined,
          isOnline: u.is_online,
          lastSeen: u.last_seen
            ? new Date(u.last_seen).toLocaleDateString()
            : "Offline",
        }));

        setRegisteredUsers((prev) => {
          // Merge server results with previous so we don't drop existing items
          const map = new Map<string, User>();
          serverResults.forEach((u) => map.set(u.id, u));
          prev.forEach((u) => {
            if (!map.has(u.id)) map.set(u.id, u);
          });
          return Array.from(map.values());
        });
      } catch (err) {
        console.warn("Server search failed:", err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter registered users based on search and quick filter
  const filteredDirectoryUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanDigits = q.replace(/\D/g, "");

    return registeredUsers.filter((u) => {
      // 1. Search Query match across phone, username, and name
      const matchesName = u.name.toLowerCase().includes(q);
      const matchesUsername = u.username.toLowerCase().includes(q);
      const userPhone = u.phone || "";
      const matchesPhone =
        Boolean(userPhone) &&
        (userPhone.toLowerCase().includes(q) ||
          (cleanDigits.length >= 3 && userPhone.replace(/\D/g, "").includes(cleanDigits)));

      const matchesSearch = !q || matchesName || matchesUsername || matchesPhone;
      if (!matchesSearch) return false;

      // 2. Filter tabs
      const isConnected = contactIds.has(u.id);
      const isPendingSent = pendingSentRecipientIds.has(u.id);

      if (directoryFilter === "available") {
        return !isConnected && !isPendingSent;
      }
      if (directoryFilter === "pending") {
        return isPendingSent || pendingReceivedMap.has(u.id);
      }
      if (directoryFilter === "connected") {
        return isConnected;
      }

      return true;
    });
  }, [registeredUsers, searchQuery, directoryFilter, contactIds, pendingSentRecipientIds, pendingReceivedMap]);

  // Filter confirmed contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanDigits = q.replace(/\D/g, "");

    return contacts.filter((c) => {
      if (!q) return true;
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesUsername = c.username.toLowerCase().includes(q);
      const userPhone = c.phone || "";
      const matchesPhone =
        Boolean(userPhone) &&
        (userPhone.toLowerCase().includes(q) ||
          (cleanDigits.length >= 3 && userPhone.replace(/\D/g, "").includes(cleanDigits)));
      return matchesName || matchesUsername || matchesPhone;
    });
  }, [contacts, searchQuery]);

  const onlineContacts = filteredContacts.filter((c) => c.isOnline);
  const offlineContacts = filteredContacts.filter((c) => !c.isOnline);

  // Send connection request
  const handleSendRequest = async (targetUser: User) => {
    const token = getStoredToken();
    if (!token) {
      showToast("Please log in to send requests", "error");
      return;
    }

    try {
      setSendingUserId(targetUser.id);
      await sendContactRequest({ recipient_id: targetUser.id }, token);
      setPendingSentRecipientIds((prev) => new Set(prev).add(targetUser.id));
      showToast(`Connection request sent to ${targetUser.name}!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to send request", "error");
    } finally {
      setSendingUserId(null);
    }
  };

  // Accept received request directly
  const handleAcceptReceivedRequest = async (requestId: string, targetUser: User) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      setAcceptingUserId(targetUser.id);
      await acceptContactRequest(requestId, token);

      // Update state
      setPendingReceivedMap((prev) => {
        const next = new Map(prev);
        next.delete(targetUser.id);
        return next;
      });
      setContactIds((prev) => new Set(prev).add(targetUser.id));
      setContacts((prev) => [targetUser, ...prev]);

      showToast(`Connected with ${targetUser.name}!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to accept request", "error");
    } finally {
      setAcceptingUserId(null);
    }
  };

  // Manual Add Contact via identifier
  const handleAddContactByIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = newContactIdentifier.trim();
    if (!identifier) return;

    const token = getStoredToken();
    if (token) {
      try {
        setIsSubmitting(true);
        await sendContactRequest({ identifier }, token);
        showToast(`Connection request sent to "${identifier}"!`, "success");
        setIsAddModalOpen(false);
        setNewContactIdentifier("");
        setNewContactName("");
        loadAllData();
      } catch (err: any) {
        showToast(err.message || "Failed to send connection request", "error");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const name = newContactName.trim() || identifier;
      const newContact: User = {
        id: `u_${Date.now()}`,
        name: name,
        username: identifier.toLowerCase().replace(/[@\s+]/g, ""),
        email: `${identifier.toLowerCase()}@fluxchat.io`,
        isOnline: true,
        bio: "New contact added locally.",
        joinedDate: "Today",
      };
      setContacts((prev) => [newContact, ...prev]);
      setContactIds((prev) => new Set(prev).add(newContact.id));
      setIsAddModalOpen(false);
      setNewContactIdentifier("");
      setNewContactName("");
      showToast(`Contact "${newContact.name}" added locally.`);
    }
  };

  // Delete confirmed contact
  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete) return;
    const { id, name } = contactToDelete;
    const token = getStoredToken();

    if (token && !id.startsWith("u_")) {
      try {
        setIsDeleting(true);
        await deleteContact(id, token);
        setContacts((prev) => prev.filter((c) => c.id !== id));
        setContactIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast(`Contact "${name}" was removed.`);
      } catch (err: any) {
        showToast(err.message || "Failed to remove contact", "error");
      } finally {
        setIsDeleting(false);
        setContactToDelete(null);
      }
    } else {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setContactIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setContactToDelete(null);
      showToast(`Contact "${name}" was removed.`);
    }
  };

  const tabs = [
    { id: "directory", label: "All Registered Users", count: registeredUsers.length },
    { id: "contacts", label: "My Contacts", count: contacts.length },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-20 right-6 z-40 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-flux-md animate-in fade-in ${
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
            Contacts & Directory
          </h1>
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#66736D] hover:text-[#168F67] hover:bg-[#F7F9F8] dark:hover:bg-[#151D1A] transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-[#168F67]" : ""}`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/requests">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              Requests
              {pendingReceivedMap.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white">
                  {pendingReceivedMap.size}
                </span>
              )}
            </Button>
          </Link>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add by ID / Phone
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full flex-1 overflow-y-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6EBE8] dark:border-[#212E29] pb-3">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              setSearchQuery("");
            }}
            variant="underlined"
          />

          {/* Quick Filter Chips for Directory */}
          {activeTab === "directory" && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
              {(
                [
                  { id: "all", label: "All Users" },
                  { id: "available", label: "Available" },
                  { id: "pending", label: "Pending" },
                  { id: "connected", label: "Connected" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setDirectoryFilter(chip.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    directoryFilter === chip.id
                      ? "bg-[var(--primary)] text-white shadow-xs"
                      : "bg-[#F7F9F8] dark:bg-[#151D1A] text-[#66736D] dark:text-[#8E9C95] hover:bg-[#E6EBE8] dark:hover:bg-[#212E29]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global Live Search Bar */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-[#66736D] dark:text-[#8E9C95] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by phone number, username, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-[#F7F9F8] dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] pl-10 pr-10 py-3 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D] focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/15 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 p-1 rounded-md text-[#66736D] hover:text-[#17211D] dark:hover:text-[#F1F5F3] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isSearchingServer && (
            <div className="absolute right-10">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin mb-3" />
            <p className="text-sm font-medium text-[#66736D] dark:text-[#8E9C95]">
              Loading directory and contacts...
            </p>
          </div>
        ) : activeTab === "directory" ? (
          /* ========================================================================= */
          /* TAB 1: ALL REGISTERED USERS DIRECTORY                                      */
          /* ========================================================================= */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
                Registered Users ({filteredDirectoryUsers.length})
              </h2>
              {searchQuery && (
                <span className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                  Showing search matches for &ldquo;{searchQuery}&rdquo;
                </span>
              )}
            </div>

            {filteredDirectoryUsers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredDirectoryUsers.map((user) => {
                  const isConnected = contactIds.has(user.id);
                  const isPendingSent = pendingSentRecipientIds.has(user.id);
                  const receivedRequestId = pendingReceivedMap.get(user.id);
                  const isSendingThisUser = sendingUserId === user.id;
                  const isAcceptingThisUser = acceptingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] shadow-xs hover:shadow-flux-sm transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <Avatar
                          name={user.name}
                          src={user.avatar}
                          size="lg"
                          isOnline={user.isOnline}
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                              {user.name}
                            </h3>
                            {isConnected && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Friend
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                            @{user.username}
                          </p>

                          {/* Phone Number Display */}
                          {user.phone ? (
                            <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F0FDF4] dark:bg-[#064E3B]/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{user.phone}</span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] mt-1 italic">
                              {user.bio || "FluxChat Member"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#F0F4F2] dark:border-[#1E2925]">
                        <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                          {user.isOnline ? "Online now" : user.lastSeen || "Offline"}
                        </span>

                        <div>
                          {isConnected ? (
                            <Link href={`/app/chats/c_${user.id}`}>
                              <Button
                                variant="soft"
                                size="sm"
                                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                              >
                                Message
                              </Button>
                            </Link>
                          ) : receivedRequestId ? (
                            <Button
                              size="sm"
                              onClick={() => handleAcceptReceivedRequest(receivedRequestId, user)}
                              disabled={isAcceptingThisUser}
                              leftIcon={
                                isAcceptingThisUser ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              Accept Request
                            </Button>
                          ) : isPendingSent ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Sent
                              </span>
                              <Link href={`/app/chats/c_${user.id}`}>
                                <Button
                                  variant="soft"
                                  size="sm"
                                  leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                                >
                                  Message
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleSendRequest(user)}
                              disabled={isSendingThisUser}
                              leftIcon={
                                isSendingThisUser ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              Send Request
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8]/50 dark:bg-[#151D1A]/50">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#17211D] dark:text-[#F1F5F3] mb-1">
                  {searchQuery ? "No matching registered users" : "No other registered users"}
                </h3>
                <p className="text-sm text-[#66736D] dark:text-[#8E9C95] max-w-sm mb-6">
                  {searchQuery
                    ? `We couldn't find anyone matching "${searchQuery}". Try searching by a different name, username, or phone number.`
                    : "Invite friends or add them by phone number/username using the Add Contact button above."}
                </p>
                {searchQuery ? (
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add by Phone / Username
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 2: MY CONFIRMED CONTACTS ROSTER                                       */
          /* ========================================================================= */
          <div className="space-y-6">
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8]/50 dark:bg-[#151D1A]/50">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-4">
                  <UserPlus className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#17211D] dark:text-[#F1F5F3] mb-1">
                  No confirmed contacts yet
                </h3>
                <p className="text-sm text-[#66736D] dark:text-[#8E9C95] max-w-sm mb-6">
                  Discover registered users in the directory tab or send connection requests by phone number.
                </p>
                <Button onClick={() => setActiveTab("directory")} leftIcon={<Users className="w-4 h-4" />}>
                  Explore All Users
                </Button>
              </div>
            ) : (
              <>
                {/* Online Contacts Section */}
                <div className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
                    Online ({onlineContacts.length})
                  </h2>
                  <div className="space-y-2">
                    {onlineContacts.length > 0 ? (
                      onlineContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] shadow-xs transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Avatar
                              name={contact.name}
                              src={contact.avatar}
                              size="md"
                              isOnline={contact.isOnline}
                            />
                            <div className="min-w-0 text-left">
                              <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                                {contact.name}
                              </h3>
                              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                                @{contact.username}
                                {contact.phone ? ` • ${contact.phone}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => alert(`Calling ${contact.name}...`)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-[#168F67] rounded-lg transition-all hidden sm:block cursor-pointer"
                              title={`Call ${contact.name}`}
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => alert(`Video calling ${contact.name}...`)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-[#168F67] rounded-lg transition-all hidden sm:block cursor-pointer"
                              title={`Video call ${contact.name}`}
                            >
                              <Video className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setContactToDelete(contact)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                              title={`Delete ${contact.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <Link href={`/app/chats/c_${contact.id}`}>
                              <Button
                                variant="soft"
                                size="sm"
                                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                              >
                                Message
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl text-center text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29]">
                        No contacts online right now.
                      </div>
                    )}
                  </div>
                </div>

                {/* Offline Contacts Section */}
                <div className="space-y-3 pt-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
                    Offline ({offlineContacts.length})
                  </h2>
                  <div className="space-y-2">
                    {offlineContacts.length > 0 ? (
                      offlineContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] shadow-xs transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Avatar
                              name={contact.name}
                              src={contact.avatar}
                              size="md"
                              isOnline={contact.isOnline}
                            />
                            <div className="min-w-0 text-left">
                              <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                                {contact.name}
                              </h3>
                              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                                @{contact.username} • {contact.lastSeen || "Offline"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setContactToDelete(contact)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                              title={`Delete ${contact.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <Link href={`/app/chats/c_${contact.id}`}>
                              <Button variant="secondary" size="sm">
                                Message
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl text-center text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29]">
                        No offline contacts.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Contact by identifier */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Send Connection Request"
        description="Search by phone number, username, or email to connect with any registered user."
      >
        <form onSubmit={handleAddContactByIdentifier} className="space-y-4">
          <Input
            id="contactIdentifier"
            label="Phone Number, Username, or Email"
            placeholder="e.g. +919876543210, john_doe, or john@example.com"
            value={newContactIdentifier}
            onChange={(e) => setNewContactIdentifier(e.target.value)}
            required
            autoFocus
          />
          <Input
            id="contactName"
            label="Display Name (Optional)"
            placeholder="e.g. John Doe"
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                "Send Request"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Contact Confirmation */}
      <Modal
        isOpen={Boolean(contactToDelete)}
        onClose={() => setContactToDelete(null)}
        title="Delete Contact"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Delete &ldquo;{contactToDelete?.name}&rdquo;?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                Are you sure you want to remove this contact from your roster? You can always reconnect by sending a new connection request.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setContactToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDeleteContact}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{isDeleting ? "Removing..." : "Delete Contact"}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
