/**
 * API client abstractions
 * In Phase 5, this will export:
 * - client.ts
 * - auth.ts
 * - users.ts
 * - conversations.ts
 * - messages.ts
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export * from "./auth";
export * from "./user";
export * from "./contact";
export * from "./chat";
export * from "./message";
export * from "./websocket";

