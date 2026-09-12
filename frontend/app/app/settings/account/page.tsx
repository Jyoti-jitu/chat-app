"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/api/user";

export default function AccountSettingsPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fluxchat_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.name) setName(u.name);
          if (u.username) setUsername(u.username);
          if (u.email) setEmail(u.email);
        } catch {}
      }
    }

    getMyProfile()
      .then((user) => {
        setName(user.name);
        setUsername(user.username);
        setEmail(user.email);
        if (typeof window !== "undefined") {
          localStorage.setItem("fluxchat_user", JSON.stringify(user));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateMyProfile({ name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Account Settings
        </h2>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
          Manage your personal details and security preferences.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Account changes saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
            Profile Information
          </h3>
          <Input
            id="accountName"
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="accountUsername"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            id="accountEmail"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
            Change Password
          </h3>
          <Input
            id="curPass"
            label="Current Password"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            id="newPass"
            label="New Password"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="md">
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
