"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  useEffect,
} from "react";
import {
  DEFAULT_ACCENT_COLOR,
  applyAccentToDOM,
} from "@/lib/utils/themeColors";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "fluxchat_theme";
const ACCENT_STORAGE_KEY = "fluxchat_accent";
const THEME_CHANGE_EVENT = "fluxchat_theme_change";

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "system";
}

function getAccentSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT_COLOR;
  return localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT_COLOR;
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function getServerAccentSnapshot(): string {
  return DEFAULT_ACCENT_COLOR;
}

function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    mediaQuery.removeEventListener("change", callback);
  };
}

function applyThemeToDOM(effectiveTheme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (effectiveTheme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const accentColor = useSyncExternalStore(
    subscribeToTheme,
    getAccentSnapshot,
    getServerAccentSnapshot
  );

  let resolvedTheme: "light" | "dark" = "light";
  if (typeof window !== "undefined") {
    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = theme;
    }
  }

  // Ensure DOM classes and CSS variables are aligned
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
    applyAccentToDOM(accentColor, resolvedTheme === "dark");
  }, [resolvedTheme, accentColor]);

  const setTheme = useCallback((newTheme: Theme) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);

    let effective: "light" | "dark" = "light";
    if (newTheme === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      effective = newTheme;
    }

    applyThemeToDOM(effective);
    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT_COLOR;
    applyAccentToDOM(storedAccent, effective === "dark");

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const setAccentColor = useCallback((color: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCENT_STORAGE_KEY, color);

    const isDark = document.documentElement.classList.contains("dark");
    applyAccentToDOM(color, isDark);

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        accentColor,
        setAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
