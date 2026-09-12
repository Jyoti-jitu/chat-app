export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  category: "green" | "blue" | "purple" | "pink" | "red" | "warm" | "neutral";
}

export const DEFAULT_ACCENT_COLOR = "#168F67";

export const ACCENT_PRESETS: AccentPreset[] = [
  // Greens
  { id: "emerald", name: "Flux Emerald", hex: "#168F67", category: "green" },
  { id: "forest", name: "Forest Deep", hex: "#0D734B", category: "green" },
  { id: "mint", name: "Vibrant Mint", hex: "#10B981", category: "green" },
  // Blues & Teals
  { id: "ocean", name: "Ocean Blue", hex: "#2563EB", category: "blue" },
  { id: "sky", name: "Sky Azure", hex: "#0284C7", category: "blue" },
  { id: "teal", name: "Nordic Teal", hex: "#0D9488", category: "blue" },
  // Purples
  { id: "indigo", name: "Electric Indigo", hex: "#4F46E5", category: "purple" },
  { id: "violet", name: "Royal Violet", hex: "#7C3AED", category: "purple" },
  { id: "orchid", name: "Orchid Magenta", hex: "#C026D3", category: "purple" },
  // Warm / Reds / Pinks
  { id: "rose", name: "Sunset Rose", hex: "#E11D48", category: "pink" },
  { id: "ruby", name: "Crimson Ruby", hex: "#DC2626", category: "red" },
  { id: "coral", name: "Warm Coral", hex: "#EA580C", category: "warm" },
  { id: "amber", name: "Golden Amber", hex: "#D97706", category: "warm" },
  // Neutral
  { id: "slate", name: "Minimal Slate", hex: "#475569", category: "neutral" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

export function adjustHexBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (channel: number) => {
    const val = Math.round(channel * (1 + percent / 100));
    return Math.min(255, Math.max(0, val))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${adjust(rgb.r)}${adjust(rgb.g)}${adjust(rgb.b)}`;
}

export function applyAccentToDOM(hex: string, isDark = false) {
  if (typeof document === "undefined") return;
  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const root = document.documentElement;
  const hoverHex = adjustHexBrightness(hex, isDark ? 15 : -12);
  const lightBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.2 : 0.12})`;
  const sentBubble = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;

  root.style.setProperty("--primary", hex);
  root.style.setProperty("--primary-hover", hoverHex);
  root.style.setProperty("--primary-light", lightBg);
  root.style.setProperty("--bubble-sent", sentBubble);
}
