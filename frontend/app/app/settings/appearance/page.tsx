"use client";

import React, { useState } from "react";
import {
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  Sparkles,
  Send,
  CheckCheck,
  Eye,
  Sliders,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useTheme } from "@/hooks/useTheme";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_COLOR,
} from "@/lib/utils/themeColors";
import { cn } from "@/lib/utils/cn";

export default function AppearanceSettingsPage() {
  const { theme, resolvedTheme, setTheme, accentColor, setAccentColor } = useTheme();

  // Custom hex color input state
  const [customHex, setCustomHex] = useState(accentColor);
  const [hexError, setHexError] = useState("");

  // Other appearance preferences (persisted locally)
  const [compactMode, setCompactMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("fluxchat_pref_compact") === "true";
  });

  const [showAvatars, setShowAvatars] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("fluxchat_pref_avatars") !== "false";
  });

  const [messagePreviews, setMessagePreviews] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("fluxchat_pref_previews") !== "false";
  });

  const [density, setDensity] = useState<"comfortable" | "compact" | "spacious">(() => {
    if (typeof window === "undefined") return "comfortable";
    const val = localStorage.getItem("fluxchat_pref_density");
    if (val === "compact" || val === "spacious" || val === "comfortable") return val;
    return "comfortable";
  });

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);

    // Validate if it's a 6-digit or 3-digit hex
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      setHexError("");
      setAccentColor(val);
    } else {
      setHexError("Enter a valid hex code (e.g. #2563EB)");
    }
  };

  const handleNativeColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    setHexError("");
    setAccentColor(val);
  };

  const handleResetToDefault = () => {
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setCustomHex(DEFAULT_ACCENT_COLOR);
    setHexError("");
  };

  const handleToggleCompact = (val: boolean) => {
    setCompactMode(val);
    localStorage.setItem("fluxchat_pref_compact", String(val));
  };

  const handleToggleAvatars = (val: boolean) => {
    setShowAvatars(val);
    localStorage.setItem("fluxchat_pref_avatars", String(val));
  };

  const handleTogglePreviews = (val: boolean) => {
    setMessagePreviews(val);
    localStorage.setItem("fluxchat_pref_previews", String(val));
  };

  const handleChangeDensity = (d: "comfortable" | "compact" | "spacious") => {
    setDensity(d);
    localStorage.setItem("fluxchat_pref_density", d);
  };

  return (
    <div className="space-y-6 text-left pb-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Appearance & Themes
        </h2>
        <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1">
          Personalize FluxChat with dark mode, custom accent colors, and interface density.
        </p>
      </div>

      {/* Theme Mode Cards */}
      <Card className="p-6 space-y-4 border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
              Theme Mode
            </h3>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
              Current active view:{" "}
              <span className="font-semibold text-[#17211D] dark:text-[#F1F5F3] capitalize">
                {resolvedTheme}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              id: "light",
              label: "Light",
              desc: "Clean white aesthetic",
              icon: <Sun className="w-5 h-5 text-amber-500" />,
            },
            {
              id: "dark",
              label: "Dark",
              desc: "Easy on the eyes",
              icon: <Moon className="w-5 h-5 text-indigo-400" />,
            },
            {
              id: "system",
              label: "System",
              desc: "Syncs with OS",
              icon: <Laptop className="w-5 h-5 text-[#66736D] dark:text-[#8E9C95]" />,
            },
          ].map((mode) => {
            const isSelected = theme === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id as "light" | "dark" | "system")}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer text-center relative group",
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary-light)] ring-2 ring-[var(--primary)]/20 shadow-xs"
                    : "border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
                )}
              >
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#1D2723] shadow-xs mb-2 group-hover:scale-105 transition-transform">
                  {mode.icon}
                </div>
                <span className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {mode.label}
                </span>
                <span className="text-[10px] text-[#66736D] dark:text-[#8E9C95] mt-0.5 hidden sm:inline">
                  {mode.desc}
                </span>
                {isSelected && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Accent Color Customizer */}
      <Card className="p-6 space-y-5 border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
              Customize Accent Color
            </h3>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-0.5">
              Pick a curated swatch or choose any custom color for buttons, bubbles, and highlights.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Default</span>
          </button>
        </div>

        {/* 14 Presets Swatches */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95]">
            Curated Color Palettes (14 Colors)
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-7 gap-2.5 pt-1">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setAccentColor(preset.hex);
                    setCustomHex(preset.hex);
                    setHexError("");
                  }}
                  title={`${preset.name} (${preset.hex})`}
                  style={{ backgroundColor: preset.hex }}
                  className={cn(
                    "h-9 w-full rounded-xl flex items-center justify-center text-white transition-all cursor-pointer shadow-xs hover:scale-105 relative group",
                    isSelected
                      ? "ring-3 ring-offset-2 ring-[var(--primary)] scale-105"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  {isSelected && <Check className="w-4 h-4 drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Input & Native Color Wheel */}
        <div className="pt-2 border-t border-[#E6EBE8] dark:border-[#212E29] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Native Color Wheel Picker */}
            <div className="relative">
              <input
                type="color"
                id="native-color-picker"
                value={accentColor}
                onChange={handleNativeColorPicker}
                className="w-10 h-10 rounded-xl cursor-pointer border border-[#E6EBE8] dark:border-[#212E29] p-0.5 bg-white dark:bg-[#1D2723]"
              />
            </div>
            <div>
              <label
                htmlFor="custom-hex-input"
                className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]"
              >
                Custom Hex Color
              </label>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  id="custom-hex-input"
                  type="text"
                  maxLength={7}
                  placeholder="#168F67"
                  value={customHex}
                  onChange={handleCustomHexChange}
                  className="w-28 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[var(--primary)]"
                />
                <span
                  className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-2xs"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Active: {customHex.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {hexError && <p className="text-xs text-rose-500 font-medium">{hexError}</p>}
      </Card>

      {/* Live Interactive Preview Card */}
      <Card className="p-6 space-y-4 border-[#E6EBE8] dark:border-[#212E29] bg-gradient-to-b from-white to-[#F7F9F8] dark:from-[#151D1A] dark:to-[#101614]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
              Live Component Preview
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-[#66736D] dark:text-[#8E9C95]">
            Updates automatically
          </span>
        </div>

        {/* Simulated Chat & Controls Preview */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] space-y-4 shadow-flux">
          {/* Sample Chat Bubble */}
          <div className="flex flex-col items-end">
            <div className="max-w-xs px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs bg-[var(--bubble-sent)] text-[#17211D] dark:text-[#F1F5F3] shadow-xs">
              <p className="font-medium">
                Testing the new custom accent color! Everything updates in real-time. 🚀
              </p>
              <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[var(--primary)] font-semibold">
                <span>12:45 PM</span>
                <CheckCheck className="w-3 h-3 text-[var(--primary)]" />
              </div>
            </div>
          </div>

          {/* Sample Interactive Buttons & Pills */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-xs">
              <Send className="w-3 h-3" />
              <span>Primary Button</span>
            </Button>
            <Button size="sm" variant="soft">
              Soft Button
            </Button>
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)]">
              Active Tab Pill
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--primary)] text-white">
              <span>● Status</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Interface Density Selector */}
      <Card className="p-6 space-y-3 border-[#E6EBE8] dark:border-[#212E29]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#66736D] dark:text-[#8E9C95]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
            Message Density
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(["comfortable", "compact", "spacious"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleChangeDensity(d)}
              className={cn(
                "py-2.5 px-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer",
                density === d
                  ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-bold"
                  : "border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#66736D] dark:text-[#8E9C95] hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723]"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      {/* Display Switches */}
      <Card className="p-6 divide-y divide-[#E6EBE8] dark:divide-[#212E29] border-[#E6EBE8] dark:border-[#212E29]">
        <Switch
          checked={compactMode}
          onChange={handleToggleCompact}
          label="Compact conversation list"
          description="Show more conversations in less space"
        />
        <Switch
          checked={showAvatars}
          onChange={handleToggleAvatars}
          label="Show contact avatars"
          description="Display profile pictures beside messages"
        />
        <Switch
          checked={messagePreviews}
          onChange={handleTogglePreviews}
          label="Message previews"
          description="Display message snippets in the conversation list"
        />
      </Card>
    </div>
  );
}
