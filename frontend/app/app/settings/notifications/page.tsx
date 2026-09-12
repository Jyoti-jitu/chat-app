"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";

export default function NotificationSettingsPage() {
  const [messages, setMessages] = useState(true);
  const [requests, setRequests] = useState(true);
  const [groups, setGroups] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [reactions, setReactions] = useState(true);
  const [sound, setSound] = useState(false);
  const [desktop, setDesktop] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Notification Settings
        </h2>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
          Choose which alerts and sounds you want to receive.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Notification settings saved!</span>
        </div>
      )}

      <Card className="p-6 divide-y divide-[#E6EBE8] dark:divide-[#212E29]">
        <Switch
          checked={messages}
          onChange={setMessages}
          label="Message notifications"
          description="Receive notifications for new private messages"
        />
        <Switch
          checked={requests}
          onChange={setRequests}
          label="Friend requests"
          description="Get notified when someone sends you a connection request"
        />
        <Switch
          checked={groups}
          onChange={setGroups}
          label="Group invitations"
          description="Alerts when you are added to a new channel"
        />
        <Switch
          checked={mentions}
          onChange={setMentions}
          label="Mentions (@you)"
          description="Alerts when someone mentions your handle in a group"
        />
        <Switch
          checked={reactions}
          onChange={setReactions}
          label="Message reactions"
          description="Notify when a contact reacts to your message"
        />
        <Switch
          checked={sound}
          onChange={setSound}
          label="In-app notification sounds"
          description="Play a subtle audio chime on incoming messages"
        />
        <Switch
          checked={desktop}
          onChange={setDesktop}
          label="Desktop push notifications"
          description="Display browser banners when the app is in the background"
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="md">
          Save preferences
        </Button>
      </div>
    </div>
  );
}
