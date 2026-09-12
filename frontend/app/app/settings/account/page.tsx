"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import {
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserCheck,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  Database,
  Loader2,
} from "lucide-react";
import { getMyProfile, updateMyProfile, UserProfile } from "@/lib/api/user";
import { changePassword } from "@/lib/api/auth";

export default function AccountSettingsPage() {
  // Live profile fields
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Profile save state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password fields & state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Copy ID feedback
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    // 1. Initial hydration from localStorage if available
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fluxchat_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          setProfile(u);
          if (u.name) setName(u.name);
          if (u.username) setUsername(u.username);
          if (u.email) setEmail(u.email);
          if (u.phone) setPhone(u.phone);
          if (u.bio) setBio(u.bio);
        } catch {}
      }
    }

    // 2. Fetch live authentic data from MongoDB Atlas via User Service
    getMyProfile()
      .then((user) => {
        setProfile(user);
        setName(user.name || "");
        setUsername(user.username || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setBio(user.bio || "");
        if (typeof window !== "undefined") {
          localStorage.setItem("fluxchat_user", JSON.stringify(user));
        }
      })
      .catch((err) => {
        console.warn("Could not fetch latest user profile:", err);
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError("");
    setProfileSuccess(false);

    try {
      const updated = await updateMyProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      });

      setProfile(updated);
      setName(updated.name);
      setUsername(updated.username);
      setEmail(updated.email);
      setPhone(updated.phone || "");
      setBio(updated.bio || "");

      if (typeof window !== "undefined") {
        localStorage.setItem("fluxchat_user", JSON.stringify(updated));
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. Please check your credentials.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const copyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const formattedJoinDate = React.useMemo(() => {
    if (!profile?.created_at) return "Recently";
    try {
      return new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  }, [profile?.created_at]);

  return (
    <div className="space-y-6 text-left pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Account Settings
        </h2>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
          Manage your personal details, credentials, and verify your account status.
        </p>
      </div>

      {/* User Live Identity Card */}
      <Card className="p-6 border-[#E6EBE8] dark:border-[#212E29] bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={name || "User"}
              size="lg"
              isOnline={profile?.is_online ?? true}
              className="ring-2 ring-white dark:ring-[#151D1A] shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {name || (isLoadingProfile ? "Loading..." : "User")}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B]">
                  <ShieldCheck className="w-3 h-3" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
                @{username || "username"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1D2723] border border-[#E6EBE8] dark:border-[#212E29] text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95]">
              <Database className="w-3.5 h-3.5 text-[#168F67] dark:text-[#22A06B]" />
              <span>MongoDB Atlas Live</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Information Form */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <Card className="p-6 space-y-4 border-[#E6EBE8] dark:border-[#212E29]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
                Profile Information
              </h3>
            </div>
            {isLoadingProfile && (
              <span className="flex items-center gap-1 text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                <Loader2 className="w-3 h-3 animate-spin" /> Fetching live data...
              </span>
            )}
          </div>

          {profileSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profile information saved and synced to database!</span>
            </div>
          )}

          {profileError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="accountName"
              label="Full Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice Smith"
              required
            />
            <Input
              id="accountUsername"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="e.g. alice_smith"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="accountEmail"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alice@example.com"
              required
            />
            <Input
              id="accountPhone"
              label="Mobile Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +919876543210"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label
              htmlFor="accountBio"
              className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]"
            >
              Bio / Status Message
            </label>
            <textarea
              id="accountBio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share a short status or bio..."
              maxLength={250}
              className="w-full rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] p-3 text-sm text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/15 transition-all"
            />
            <div className="flex justify-end text-[10px] text-[#66736D] dark:text-[#8E9C95]">
              <span>{bio.length}/250 characters</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="md"
              disabled={isSavingProfile || isLoadingProfile}
              className="gap-2"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <span>Save Profile Changes</span>
              )}
            </Button>
          </div>
        </Card>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="space-y-4">
        <Card className="p-6 space-y-4 border-[#E6EBE8] dark:border-[#212E29]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
              Security & Password
            </h3>
          </div>
          <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
            Ensure your account is protected with a strong, secure password (minimum 6 characters).
          </p>

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully! Next login will require your new password.</span>
            </div>
          )}

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="space-y-3">
            <Input
              id="curPass"
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="newPass"
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input
                id="confirmPass"
                label="Confirm New Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={isSavingPassword || !currentPassword || !newPassword}
              className="gap-2"
            >
              {isSavingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying & Updating...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </div>
        </Card>
      </form>

      {/* Account Metadata & Identification */}
      <Card className="p-6 space-y-4 border-[#E6EBE8] dark:border-[#212E29]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
          Account Details & Identification
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
          {/* Account ID */}
          <div className="p-3.5 rounded-2xl bg-[#F7F9F8] dark:bg-[#1D2723] border border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95] block">
                User Account ID
              </span>
              <span className="font-mono font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {profile?.id || "Unavailable"}
              </span>
            </div>
            {profile?.id && (
              <button
                type="button"
                onClick={copyUserId}
                title="Copy User ID"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#66736D] dark:text-[#8E9C95] transition-colors cursor-pointer"
              >
                {copiedId ? (
                  <Check className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Member Since */}
          <div className="p-3.5 rounded-2xl bg-[#F7F9F8] dark:bg-[#1D2723] border border-[#E6EBE8] dark:border-[#212E29] flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white dark:bg-[#151D1A] text-[#168F67] dark:text-[#22A06B] shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95] block">
                Member Since
              </span>
              <span className="font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {formattedJoinDate}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
