"use client";

import { useEffect } from "react";
import { wsClient } from "@/lib/api/websocket";
import { getStoredToken } from "@/lib/api/auth";

export function WebSocketManager() {
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      wsClient.connect(token);
    }

    // Re-connect on window focus/visibility change if disconnected
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentToken = getStoredToken();
        if (currentToken && !wsClient.isConnected()) {
          wsClient.connect(currentToken);
        }
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  return null;
}
