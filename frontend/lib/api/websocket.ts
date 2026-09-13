/**
 * Real-Time WebSocket Client for FluxChat.
 * Interfaces with the FastAPI WebSocket Service running on port 8005.
 * Provides auto-reconnection, heartbeat keep-alive, typed event listeners,
 * and ephemeral typing indicator helpers.
 */
import { getStoredToken } from "./auth";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http(s?):/, "ws$1:") + "/ws"
    : "ws://localhost:8005/ws");

export type EventCallback = (data: any) => void;

export interface WebSocketEventFrame {
  event: string;
  data: Record<string, any>;
  timestamp?: number;
}

export class FluxWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private explicitDisconnect = false;
  private activeToken: string | null = null;
  private hasWindowListeners = false;

  constructor() {
    this.setupWindowListeners();
  }

  private setupWindowListeners(): void {
    if (typeof window === "undefined" || this.hasWindowListeners) return;
    this.hasWindowListeners = true;

    window.addEventListener("online", () => {
      console.info("[FluxChat WS] Network restored. Reconnecting socket...");
      this.reconnectAttempts = 0;
      this.connect();
    });

    window.addEventListener("focus", () => {
      if (!this.isConnected() && !this.explicitDisconnect) {
        this.connect();
      }
    });
  }

  /**
   * Establishes authenticated WebSocket connection.
   */
  public connect(customToken?: string): void {
    if (typeof window === "undefined") return;

    // Disconnect existing if any
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = customToken || getStoredToken();
    if (!token) {
      console.warn("[FluxChat WS] Cannot connect without valid access token.");
      return;
    }

    this.activeToken = token;
    this.explicitDisconnect = false;
    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.info("[FluxChat WS] Connection established.");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit("open", {});
      };

      this.socket.onmessage = (messageEvent: MessageEvent) => {
        try {
          const frame: WebSocketEventFrame = JSON.parse(messageEvent.data);
          this.emit(frame.event, frame.data);
        } catch (err) {
          console.warn("[FluxChat WS] Failed to parse incoming frame:", err);
        }
      };

      this.socket.onerror = (err) => {
        console.warn("[FluxChat WS] Socket error:", err);
        this.emit("error", err);
      };

      this.socket.onclose = (closeEvent) => {
        this.stopHeartbeat();
        this.emit("close", closeEvent);

        // Handshake rejection (e.g. 1008 policy violation)
        if (closeEvent.code === 1008) {
          console.error("[FluxChat WS] Handshake rejected by server (Policy Violation / Unauthorized).");
          return;
        }

        if (!this.explicitDisconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error("[FluxChat WS] Connection initialization failed:", err);
      this.scheduleReconnect();
    }
  }

  /**
   * Closes active WebSocket connection cleanly.
   */
  public disconnect(): void {
    this.explicitDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Returns true if connection is active and open.
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Dispatches a typed JSON event frame over WebSocket.
   */
  public send(event: string, data: Record<string, any> = {}): void {
    if (!this.isConnected() || !this.socket) {
      console.warn(`[FluxChat WS] Cannot send event '${event}': socket is not connected.`);
      return;
    }
    const frame: WebSocketEventFrame = {
      event,
      data,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.socket.send(JSON.stringify(frame));
  }

  /**
   * Helper to dispatch typing start or typing stop.
   */
  public sendTyping(
    conversationId: string,
    isTyping: boolean,
    recipientIds?: string[]
  ): void {
    this.send(isTyping ? "typing.start" : "typing.stop", {
      conversation_id: conversationId,
      recipient_ids: recipientIds,
    });
  }

  /**
   * Helper to notify message read.
   */
  public markMessageRead(
    messageId: string,
    conversationId: string,
    recipientIds?: string[]
  ): void {
    this.send("message.read", {
      message_id: messageId,
      conversation_id: conversationId,
      recipient_ids: recipientIds,
    });
  }

  /**
   * Register event listener.
   */
  public on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener.
   */
  public off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * Internal event emitter.
   */
  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error(`[FluxChat WS] Listener error for event '${event}':`, e);
        }
      });
    }
  }

  /**
   * Ping/Pong heartbeat timer.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send("ping", {});
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Continuous exponential backoff reconnection scheduler.
   */
  private scheduleReconnect(): void {
    if (this.explicitDisconnect) return;

    // Continuous reconnection with max backoff of 8000ms
    const backoff = Math.min(1000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)), 8000);
    this.reconnectAttempts += 1;
    console.info(`[FluxChat WS] Reconnecting in ${Math.round(backoff)}ms (attempt ${this.reconnectAttempts})...`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.activeToken || undefined);
    }, backoff);
  }
}

// Global shared client instance
export const wsClient = new FluxWebSocketClient();
