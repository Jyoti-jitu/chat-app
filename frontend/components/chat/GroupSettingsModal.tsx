"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Shield,
  Users,
  UserCheck,
  UserX,
  Upload,
  Camera,
  Link2,
  Check,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ConversationItem,
  GroupJoinRequestItem,
  approveGroupJoinRequest,
  rejectGroupJoinRequest,
  updateGroupSettings,
  promoteMemberToAdmin,
  removeMemberFromGroup,
} from "@/lib/api/chat";
import { uploadMedia } from "@/lib/api/media";
import { getStoredToken } from "@/lib/api/auth";

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationItem;
  currentUserId: string;
  onConversationUpdated: (updated: ConversationItem) => void;
}

export function GroupSettingsModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onConversationUpdated,
}: GroupSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "requests" | "members">("general");
  const [groupName, setGroupName] = useState(conversation.name || "");
  const [description, setDescription] = useState(conversation.description || "");
  const [joinMode, setJoinMode] = useState<"open" | "approval">(
    conversation.join_mode || "open"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    conversation.avatar || undefined
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const admins = conversation.admins || [];
  const isAdmin =
    admins.includes(currentUserId) || conversation.created_by === currentUserId;
  const joinRequests: GroupJoinRequestItem[] = conversation.join_requests || [];

  useEffect(() => {
    if (isOpen) {
      setGroupName(conversation.name || "");
      setDescription(conversation.description || "");
      setJoinMode(conversation.join_mode || "open");
      setAvatarUrl(conversation.avatar || undefined);
      setNotice(null);
    }
  }, [isOpen, conversation]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const token = getStoredToken();
      const res = await uploadMedia(file, "fluxchat/groups", token || undefined);
      setAvatarUrl(res.secure_url || res.url);
      showNotification("Group avatar uploaded to Cloudinary!");
    } catch (err: any) {
      alert(err.message || "Failed to upload avatar to Cloudinary");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      setIsSaving(true);
      const token = getStoredToken();
      if (!token) return;

      const updated = await updateGroupSettings(
        conversation.id,
        {
          name: groupName.trim(),
          description: description.trim() || undefined,
          join_mode: joinMode,
          avatar: avatarUrl || undefined,
        },
        token
      );
      onConversationUpdated(updated);
      showNotification("Group settings saved successfully!");
      setTimeout(onClose, 800);
    } catch (err: any) {
      alert(err.message || "Failed to save group settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveRequest = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      const token = getStoredToken();
      if (!token) return;

      const updated = await approveGroupJoinRequest(conversation.id, userId, token);
      onConversationUpdated(updated);
      showNotification("User approved and added to group!");
    } catch (err: any) {
      alert(err.message || "Failed to approve request");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      const token = getStoredToken();
      if (!token) return;

      await rejectGroupJoinRequest(conversation.id, userId, token);
      const updatedRequests = (conversation.join_requests || []).filter(
        (r) => r.user_id !== userId
      );
      onConversationUpdated({ ...conversation, join_requests: updatedRequests });
      showNotification("Join request rejected.");
    } catch (err: any) {
      alert(err.message || "Failed to reject request");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePromoteAdmin = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      const token = getStoredToken();
      if (!token) return;

      const updated = await promoteMemberToAdmin(conversation.id, userId, token);
      onConversationUpdated(updated);
      showNotification("Member promoted to Group Admin!");
    } catch (err: any) {
      alert(err.message || "Failed to promote member");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      setActionLoadingId(userId);
      const token = getStoredToken();
      if (!token) return;

      const updated = await removeMemberFromGroup(conversation.id, userId, token);
      onConversationUpdated(updated);
      showNotification("Member removed from group.");
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/app/chats/${conversation.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#151D1A] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E6EBE8] dark:border-[#212E29] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#168F67] dark:text-[#22A06B]" />
            <h2 className="text-base font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Group Info & Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#66736D] hover:text-[#17211D] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>{notice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E6EBE8] dark:border-[#212E29] px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "general"
                ? "border-[#168F67] text-[#168F67] dark:text-[#22A06B] dark:border-[#22A06B]"
                : "border-transparent text-[#66736D] hover:text-[#17211D] dark:text-[#8E9C95] dark:hover:text-white"
            }`}
          >
            General & Access
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "requests"
                  ? "border-[#168F67] text-[#168F67] dark:text-[#22A06B] dark:border-[#22A06B]"
                  : "border-transparent text-[#66736D] hover:text-[#17211D] dark:text-[#8E9C95] dark:hover:text-white"
              }`}
            >
              <span>Join Requests</span>
              {joinRequests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === "members"
                ? "border-[#168F67] text-[#168F67] dark:text-[#22A06B] dark:border-[#22A06B]"
                : "border-transparent text-[#66736D] hover:text-[#17211D] dark:text-[#8E9C95] dark:hover:text-white"
            }`}
          >
            <span>Members ({conversation.members?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === "general" && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Group Photo with Cloudinary Upload */}
              <div className="flex items-center gap-4">
                <div className="relative group/avatar shrink-0">
                  <Avatar name={groupName || "Group"} src={avatarUrl} size="lg" />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      title="Upload group photo to Cloudinary"
                      className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                    Group Photo
                  </h3>
                  <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                    {isAdmin
                      ? "Click photo to change avatar using Cloudinary."
                      : "Group avatar set by group admin."}
                  </p>
                </div>
              </div>

              {/* Group Name */}
              <Input
                id="groupName"
                label="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={!isAdmin || isSaving}
                required
              />

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-1.5">
                  Group Description & Topic
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isAdmin || isSaving}
                  placeholder="What is this group about?"
                  rows={2}
                  className="w-full rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-transparent px-3 py-2 text-xs text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67]/50"
                />
              </div>

              {/* Join Mode Selector */}
              {isAdmin && (
                <div className="space-y-2 pt-2 border-t border-[#E6EBE8] dark:border-[#212E29]">
                  <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block">
                    Group Admission & Join Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setJoinMode("open")}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        joinMode === "open"
                          ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[#1B2F25] text-[#168F67] dark:text-[#22A06B]"
                          : "border-[#E6EBE8] dark:border-[#212E29] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs">
                        <Globe className="w-4 h-4" />
                        <span>Anyone Can Join</span>
                      </div>
                      <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] leading-relaxed">
                        Anyone with the group link can join instantly.
                      </p>
                    </div>

                    <div
                      onClick={() => setJoinMode("approval")}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        joinMode === "approval"
                          ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[#1B2F25] text-[#168F67] dark:text-[#22A06B]"
                          : "border-[#E6EBE8] dark:border-[#212E29] hover:bg-[#F4F6F5] dark:hover:bg-[#1D2723]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs">
                        <Lock className="w-4 h-4" />
                        <span>Admin Approval</span>
                      </div>
                      <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] leading-relaxed">
                        New users must request and be approved by an admin.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Share Invite Link */}
              <div className="pt-2 border-t border-[#E6EBE8] dark:border-[#212E29]">
                <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block mb-2">
                  Share Group Invite Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/app/chats/${conversation.id}`}
                    className="flex-1 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] border border-transparent px-3 py-2 text-xs text-[#66736D] dark:text-[#8E9C95] select-all truncate"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyInviteLink}
                  >
                    {copiedLink ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Copy
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              {isAdmin && (
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* Join Requests Tab */}
          {activeTab === "requests" && (
            <div className="space-y-3">
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                Review and approve people waiting to join this group.
              </p>
              {joinRequests.length > 0 ? (
                <div className="space-y-2">
                  {joinRequests.map((req) => (
                    <div
                      key={req.user_id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#F7F9F8] dark:bg-[#1B2622] border border-[#E6EBE8] dark:border-[#212E29]"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={req.name} src={req.avatar || undefined} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3]">
                            {req.name}
                          </p>
                          <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                            @{req.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRejectRequest(req.user_id)}
                          disabled={actionLoadingId === req.user_id}
                          className="text-xs text-rose-500 hover:text-rose-600"
                        >
                          <UserX className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(req.user_id)}
                          disabled={actionLoadingId === req.user_id}
                          className="text-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-[#66736D] dark:text-[#8E9C95] text-xs">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm text-[#17211D] dark:text-[#F1F5F3]">
                    No pending requests
                  </p>
                  <p className="text-[11px] mt-1">
                    When users request to join this group, their requests will show up here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {(conversation.members || []).map((m) => {
                  const isMemberAdmin = admins.includes(m.id);
                  const isCreator = conversation.created_by === m.id;
                  const canManage =
                    isAdmin && m.id !== currentUserId && !isCreator;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={m.name}
                          src={m.avatar || undefined}
                          size="sm"
                          isOnline={m.is_online}
                        />
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                              {m.name}
                            </p>
                            {isMemberAdmin && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold">
                                {isCreator ? "Creator" : "Admin"}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#66736D] dark:text-[#8E9C95] truncate">
                            @{m.username}
                          </p>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          {!isMemberAdmin && (
                            <button
                              type="button"
                              onClick={() => handlePromoteAdmin(m.id)}
                              disabled={actionLoadingId === m.id}
                              title="Make group admin"
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-[#168F67] dark:text-[#22A06B] hover:bg-[#EAF5F0] dark:hover:bg-[#1D2F25] transition-colors cursor-pointer"
                            >
                              Make Admin
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={actionLoadingId === m.id}
                            title="Remove from group"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
