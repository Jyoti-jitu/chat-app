"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";

export default function PrivacySettingsPage() {
  const [messagePerm, setMessagePerm] = useState("everyone");
  const [onlinePerm, setOnlinePerm] = useState("contacts");
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Privacy Settings
        </h2>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
          Control your visibility and who can interact with you on FluxChat.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>Privacy preferences updated!</span>
        </div>
      )}

      {/* Permissions */}
      <Card className="p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
          Direct Messaging
        </h3>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
          Who can initiate conversations with you?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {["everyone", "contacts", "nobody"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setMessagePerm(opt)}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize cursor-pointer transition-all ${
                messagePerm === opt
                  ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B]"
                  : "border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#66736D] dark:text-[#8E9C95]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
          Online Status Visibility
        </h3>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
          Who can see when you are active on the platform?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {["everyone", "contacts", "nobody"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setOnlinePerm(opt)}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize cursor-pointer transition-all ${
                onlinePerm === opt
                  ? "border-[#168F67] bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B]"
                  : "border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#66736D] dark:text-[#8E9C95]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      {/* Receipts & Indicators */}
      <Card className="p-6 divide-y divide-[#E6EBE8] dark:divide-[#212E29]">
        <Switch
          checked={readReceipts}
          onChange={setReadReceipts}
          label="Read receipts"
          description="Let contacts know when you have viewed their messages"
        />
        <Switch
          checked={typingIndicator}
          onChange={setTypingIndicator}
          label="Typing indicator"
          description="Show others when you are typing a message"
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
