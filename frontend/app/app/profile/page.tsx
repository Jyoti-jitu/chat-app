"use client";

import React, { useState } from "react";
import {
  Mail,
  AtSign,
  Calendar,
  Edit2,
  MessageSquare,
  Users,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { currentUser as initialUser } from "@/lib/mock/users";
import { User } from "@/types/user";

export default function ProfilePage() {
  const [user, setUser] = useState<User>(initialUser);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");
  const [email, setEmail] = useState(user.email);
  const [successNotice, setSuccessNotice] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUser((prev) => ({
      ...prev,
      name,
      bio,
      email,
    }));
    setIsEditModalOpen(false);
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-y-auto transition-colors">
      <div className="max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-6">
        {/* Profile Card with Cover Banner matching panel 8 */}
        <div className="relative rounded-3xl overflow-hidden border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux">
          {/* Scenic Nature Cover Banner */}
          <div className="h-44 sm:h-52 w-full bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 relative overflow-hidden">
            {/* Subtle nature decorative shapes */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          </div>

          {/* Profile Header Block */}
          <div className="px-6 sm:px-8 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
              <div className="flex items-end gap-4">
                <Avatar
                  name={user.name}
                  size="2xl"
                  isOnline={user.isOnline}
                  className="ring-4 ring-white dark:ring-[#151D1A] shadow-md"
                />
                <div className="mb-2 text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                    {user.name}
                  </h1>
                  <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                    @{user.username}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setIsEditModalOpen(true)}
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit Profile
              </Button>
            </div>

            {/* Bio statement */}
            <p className="text-sm text-[#17211D] dark:text-[#F1F5F3] max-w-xl text-left leading-relaxed">
              {user.bio}
            </p>

            {successNotice && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile updated successfully!</span>
              </div>
            )}
          </div>

          {/* Stats Bar matching panel 8 */}
          <div className="grid grid-cols-3 border-t border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8] dark:bg-[#131A17] divide-x divide-[#E6EBE8] dark:divide-[#212E29] py-4 text-center">
            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.chats || 24}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chats</span>
              </div>
            </div>

            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.connections || 128}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>Connections</span>
              </div>
            </div>

            <div>
              <div className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
                {user.stats?.groups || 12}
              </div>
              <div className="text-xs text-[#66736D] dark:text-[#8E9C95] font-medium flex items-center justify-center gap-1 mt-0.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Groups</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Information Section matching panel 8 */}
        <div className="p-6 rounded-3xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux space-y-5 text-left">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E6EBE8] dark:border-[#212E29]">
            <Sparkles className="w-4 h-4 text-[#168F67] dark:text-[#22A06B]" />
            <h2 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Personal Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Email</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <AtSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Username</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  @{user.username}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1D2723] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">Member since</p>
                <p className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {user.joinedDate || "Jan 2024"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        description="Update your display name, bio, and public information."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            id="editName"
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="editEmail"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="editBio"
              className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]"
            >
              Bio
            </label>
            <textarea
              id="editBio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] p-3 text-sm text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/15"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
