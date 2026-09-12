/**
 * Auth Service REST API client for FluxChat.
 * Interfaces with the FastAPI Auth Service running on port 8001.
 */

export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
  "http://localhost:8000";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginOtpPayload {
  phone: string;
  otp: string;
  session_id: string;
}

export interface SendOtpPayload {
  phone: string;
  purpose?: "register" | "login" | "reset_password";
  channel?: "sms" | "voice";
}

export interface VerifyOtpPayload {
  phone: string;
  otp: string;
  session_id: string;
}

export interface RegisterPayload {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  verification_token?: string | null;
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  user_id?: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  session_id: string;
  resend_cooldown?: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verification_token?: string;
}

export interface AuthUserResponse {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  is_verified?: boolean;
}

/**
 * Token management helpers
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("fluxchat_access_token") ||
    localStorage.getItem("accessToken")
  );
}

export function setStoredToken(token: string, user?: any): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("fluxchat_access_token", token);
  localStorage.setItem("accessToken", token);
  if (user) {
    localStorage.setItem("fluxchat_user", JSON.stringify(user));
  }
}

export function removeStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fluxchat_access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("fluxchat_user");
}

/**
 * Dispatches an SMS or Voice OTP to the provided phone number.
 */
export async function sendOtp(payload: SendOtpPayload): Promise<SendOtpResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: payload.phone,
      purpose: payload.purpose || "login",
      channel: payload.channel || "voice",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to dispatch OTP");
  }
  return data;
}

/**
 * Verifies the 6-digit OTP code against 2Factor.
 */
export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "OTP verification failed");
  }
  return data;
}

/**
 * Authenticates user via username/email/phone and password.
 */
export async function login(payload: LoginPayload): Promise<AuthTokensResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Invalid credentials");
  }
  if (data.access_token) {
    setStoredToken(data.access_token, data.user);
  }
  return data;
}

/**
 * Authenticates user via verified phone OTP.
 */
export async function loginWithOtp(payload: LoginOtpPayload): Promise<AuthTokensResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/login-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "OTP login failed");
  }
  if (data.access_token) {
    setStoredToken(data.access_token, data.user);
  }
  return data;
}

/**
 * Registers a new user account.
 */
export async function register(payload: RegisterPayload): Promise<AuthTokensResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Registration failed");
  }
  if (data.access_token) {
    setStoredToken(data.access_token, data.user);
  }
  return data;
}

/**
 * Fetches current authenticated user details from Auth Service.
 */
export async function getAuthMe(token?: string): Promise<AuthUserResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: authToken ? `Bearer ${authToken}` : "",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch user session");
  }
  return data;
}

/**
 * Logs out the current user and invalidates the token.
 */
export async function logout(token?: string): Promise<{ message: string }> {
  const authToken = token || getStoredToken();
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    });
    return await res.json();
  } finally {
    removeStoredToken();
  }
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  status: string;
  message: string;
}

/**
 * Updates the user's password after validating current password.
 */
export async function changePassword(
  payload: ChangePasswordPayload,
  token?: string
): Promise<ChangePasswordResponse> {
  const authToken = token || getStoredToken();
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken ? `Bearer ${authToken}` : "",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update password");
  }
  return data;
}

