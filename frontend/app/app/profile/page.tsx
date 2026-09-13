"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mail,
  AtSign,
  Phone,
  Globe,
  Calendar,
  Edit2,
  Camera,
  ExternalLink,
  MessageSquare,
  Users,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { User } from "@/types/user";
import { getMyProfile, updateMyProfile } from "@/lib/api/user";
import { getConversations } from "@/lib/api/chat";
import { getContacts } from "@/lib/api/contact";
import { uploadMedia } from "@/lib/api/media";

// Helper to compress and convert client image files to responsive base64 data URIs
function processImageFile(
  file: File,
  onProcessed: (dataUri: string) => void,
  maxDimension = 1000,
  quality = 0.85
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        onProcessed(compressed);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export default function ProfilePage() {
  const [user, setUser] = useState<User>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fluxchat_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          return {
            id: u.id || "",
            name: u.name || "User",
            username: u.username || "",
            email: u.email || "",
            phone: u.phone || "",
            bio: u.bio || "",
            avatar: u.avatar || undefined,
            coverImage: u.cover_image || undefined,
            website: u.website || "",
            isOnline: true,
            joinedDate: u.created_at
              ? new Date(u.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "Recently",
            stats: { chats: 0, connections: 0, groups: 0 },
          };
        } catch {}
      }
    }
    return {
      id: "",
      name: "User",
      username: "",
      email: "",
      phone: "",
      bio: "",
      website: "",
      isOnline: true,
      joinedDate: "Recently",
      stats: { chats: 0, connections: 0, groups: 0 },
    };
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Modal editing form state
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [website, setWebsite] = useState(user.website || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar);
  const [coverImage, setCoverImage] = useState<string | undefined>(user.coverImage);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Sync edit form with current live user state when modal opens
  const openEditModal = () => {
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setPhone(user.phone || "");
    setWebsite(user.website || "");
    setBio(user.bio || "");
    setAvatar(user.avatar);
    setCoverImage(user.coverImage);
    setErrorMessage("");
    setIsEditModalOpen(true);
  };

  // Fetch live profile and real counts from User & Chat Services
  useEffect(() => {
    async function loadLiveProfileData() {
      try {
        const [liveUser, convs, contactsRes] = await Promise.allSettled([
          getMyProfile(),
          getConversations(),
          getContacts(),
        ]);

        let chatsCount = 0;
        let groupsCount = 0;
        let connectionsCount = 0;

        if (convs.status === "fulfilled" && Array.isArray(convs.value)) {
          chatsCount = convs.value.length;
          groupsCount = convs.value.filter((c) => c.type === "group").length;
        }

        if (contactsRes.status === "fulfilled" && contactsRes.value?.items) {
          connectionsCount = contactsRes.value.items.length;
        }

        if (liveUser.status === "fulfilled" && liveUser.value) {
          const u = liveUser.value;
          const joinedFormatted = u.created_at
            ? new Date(u.created_at).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })
            : "Recently";

          setUser({
            id: u.id,
            name: u.name,
            username: u.username || "",
            email: u.email,
            phone: u.phone || "",
            bio: u.bio || "",
            avatar: u.avatar || undefined,
            coverImage: u.cover_image || undefined,
            website: u.website || "",
            isOnline: u.is_online,
            joinedDate: joinedFormatted,
            stats: {
              chats: chatsCount,
              connections: connectionsCount,
              groups: groupsCount,
            },
          });
          setName(u.name);
          setUsername(u.username || "");
          setBio(u.bio || "");
          setEmail(u.email);
          setPhone(u.phone || "");
          setWebsite(u.website || "");
          setAvatar(u.avatar || undefined);
          setCoverImage(u.cover_image || undefined);

          if (typeof window !== "undefined") {
            localStorage.setItem("fluxchat_user", JSON.stringify(u));
            window.dispatchEvent(new Event("fluxchat:profile_updated"));
          }
        }
      } catch (err) {
        console.warn("Error loading live profile details:", err);
      }
    }
    loadLiveProfileData();
  }, []);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAvatar(true);
      const res = await uploadMedia(file, "fluxchat/avatars");
      setAvatar(res.url);
    } catch {
      processImageFile(file, (dataUri) => {
        setAvatar(dataUri);
      }, 400, 0.88);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingCover(true);
      const res = await uploadMedia(file, "fluxchat/covers");
      setCoverImage(res.url);
    } catch {
      processImageFile(file, (dataUri) => {
        setCoverImage(dataUri);
      }, 1200, 0.82);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      const updated = await updateMyProfile({
        name: name.trim(),
        username: username.trim().toLowerCase() || undefined,
        bio: bio.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        avatar: avatar || undefined,
        cover_image: coverImage || undefined,
      });

      const updatedUserObj: User = {
        ...user,
        name: updated.name,
        username: updated.username || "",
        bio: updated.bio || "",
        email: updated.email,
        phone: updated.phone || "",
        website: updated.website || "",
        avatar: updated.avatar || undefined,
        coverImage: updated.cover_image || undefined,
      };

      setUser(updatedUserObj);

      if (typeof window !== "undefined") {
        localStorage.setItem("fluxchat_user", JSON.stringify(updated));
        window.dispatchEvent(new Event("fluxchat:profile_updated"));
      }

      setIsEditModalOpen(false);
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile. Please check your information.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-y-auto transition-colors">
      <div className="max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-6">
        {/* Dynamic Profile Card with Cover Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux">
          {/* Background / Cover Image Banner */}
          <div className="h-44 sm:h-60 w-full relative overflow-hidden group bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800">
            {user.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.coverImage}
                alt="Profile background"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <>
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
              </>
            )}

            {/* Gradient overlay for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

            {/* Quick Action: Change Cover Button */}
            <button
              type="button"
              onClick={openEditModal}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-sm cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Change Cover</span>
            </button>
          </div>

          {/* Profile Header Block */}
          <div className="px-6 sm:px-8 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
              <div className="flex items-end gap-4">
                {/* Avatar with dynamic photo and quick-edit badge */}
                <div className="relative group">
                  <Avatar
                    src={user.avatar}
                    name={user.name}
                    size="2xl"
                    isOnline={user.isOnline}
                    className="ring-4 ring-white dark:ring-[#151D1A] shadow-lg"
                  />
                  <button
                    type="button"
                    onClick={openEditModal}
                    title="Change Profile Photo"
                    className="absolute bottom-1 right-1 p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mb-2 text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                    {user.name}
                  </h1>
                  <p className="text-xs text-[#66736D] dark:text-[#8E9C95] flex items-center gap-1 mt-0.5">
                    {user.username ? (
                      <span>@{user.username}</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        No username set
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <Button
                onClick={openEditModal}
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit Profile
              </Button>
            </div>

            {/* Bio statement */}
            <p className="text-sm text-[#17211D] dark:text-[#F1F5F3] max-w-xl text-left leading-relaxed">
              {user.bio || "No bio yet. Click Edit Profile to add a personal bio."}
            </p>

            {/* Dynamic Link / Website Pill */}
            {user.website && (
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline border border-emerald-500/20 transition-colors shadow-2xs"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-xs">
                    {user.website.replace(/^https?:\/\//, "")}
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>
            )}

            {successNotice && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile updated successfully!</span>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 border-t border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8] dark:bg-[#131A17] divide-x divide-[#E6EBE8] dark:divide-[#212E29] py-4 text-center">
            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.chats || 0}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chats</span>
              </div>
            </div>

            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.connections || 0}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>Connections</span>
              </div>
            </div>

            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.groups || 0}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Groups</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Information Section */}
        <div className="p-6 rounded-3xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux space-y-5 text-left">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E6EBE8] dark:border-[#212E29]">
            <Sparkles className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />
            <h2 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Personal Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Email</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                  {user.email || "Not specified"}
                </p>
              </div>
            </div>

            {/* Username */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <AtSign className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Username</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                  {user.username ? `@${user.username}` : "Not set"}
                </p>
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Phone Number</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                  {user.phone || (
                    <span
                      onClick={openEditModal}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer hover:underline"
                    >
                      + Add phone number
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Website / Portfolio Link */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Website / Link</p>
                {user.website ? (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
                  >
                    <span className="truncate">{user.website}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span
                    onClick={openEditModal}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer hover:underline"
                  >
                    + Add your personal link
                  </span>
                )}
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Member since</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {user.joinedDate || "Recently"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        description="Customize your profile photo, cover image, name, username, phone, and links."
        size="lg"
      >
        <form onSubmit={handleSaveProfile} className="space-y-5 text-left">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hidden File Inputs for Photo Uploads */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFileChange}
          />

          {/* Photos Customization Section */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#F7F9F8] dark:bg-[#131A17] border border-[#E6EBE8] dark:border-[#212E29]">
            <span className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] block">
              Profile Photos & Background
            </span>

            {/* Background Cover Image Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95] mb-1.5">
                Background Cover Banner
              </label>
              <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-800 border border-[#E6EBE8] dark:border-[#212E29]">
                {coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white/80 font-medium">
                    Default Gradient Background
                  </div>
                )}

                <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isUploadingCover}
                    onClick={() => coverInputRef.current?.click()}
                    leftIcon={
                      isUploadingCover ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )
                    }
                    className="bg-white/90 dark:bg-black/60 text-xs backdrop-blur-xs"
                  >
                    {isUploadingCover ? "Uploading..." : coverImage ? "Change Cover" : "Upload Cover"}
                  </Button>
                  {coverImage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCoverImage(undefined)}
                      className="bg-white/90 dark:bg-black/60 text-xs text-rose-500 hover:text-rose-600 backdrop-blur-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Avatar Photo Picker */}
            <div className="flex items-center gap-4 pt-2">
              <Avatar
                src={avatar}
                name={name || "User"}
                size="xl"
                className="ring-2 ring-emerald-500 shadow-sm shrink-0"
              />
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] block">
                  Profile Avatar
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isUploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    leftIcon={
                      isUploadingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {isUploadingAvatar ? "Uploading..." : avatar ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {avatar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAvatar(undefined)}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                  Recommended square JPG, PNG, or WEBP image.
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="editName"
              label="Full Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              required
            />

            <Input
              id="editUsername"
              label="Username (@handle)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex_j"
              hint="Letters, numbers, and underscores only"
            />

            <Input
              id="editPhone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 555-0199"
            />

            <Input
              id="editWebsite"
              label="Website or Social Link"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. https://myportfolio.com"
            />

            <div className="sm:col-span-2">
              <Input
                id="editEmail"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Bio textarea */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label
                htmlFor="editBio"
                className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]"
              >
                Bio / About Me
              </label>
              <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95]">
                {bio.length}/250
              </span>
            </div>
            <textarea
              id="editBio"
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others a little about yourself, your role, or what you work on..."
              className="w-full rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] p-3 text-sm text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/15 transition-all"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              leftIcon={
                isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined
              }
            >
              {isSaving ? "Saving Profile..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
