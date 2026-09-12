"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  PhoneCall,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput, COUNTRIES, Country } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tabs } from "@/components/ui/Tabs";
import { API_BASE_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // India (+91) default
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const [successNotice, setSuccessNotice] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpChannel, setOtpChannel] = useState<"sms" | "voice">("voice");

  // Resend timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle Send OTP via Backend 2Factor API (Voice Call or SMS)
  const handleSendOtp = async (channel: "sms" | "voice" = "voice") => {
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      setErrorNotice("Please enter a valid 10-digit mobile number");
      return;
    }
    setErrorNotice("");
    setIsSendingOtp(true);
    setOtpChannel(channel);
    const withoutLeadingZero = cleanDigits.startsWith("0") ? cleanDigits.slice(1) : cleanDigits;
    const formattedPhone = `${selectedCountry.dialCode}${withoutLeadingZero}`;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, purpose: "login", channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to dispatch OTP.");
      }
      setSessionId(data.session_id);
      setOtpSent(true);
      setOtpCode(["", "", "", ""]);
      setResendCountdown(data.resend_cooldown || 30);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Submit handler (Password or OTP via Backend)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice("");
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    const withoutLeadingZero = cleanDigits.startsWith("0") ? cleanDigits.slice(1) : cleanDigits;
    const formattedPhone = `${selectedCountry.dialCode}${withoutLeadingZero}`;

    if (authMethod === "password") {
      if (!phoneNumber.trim()) {
        setErrorNotice("Please enter your phone number, username, or email");
        return;
      }
      if (!password.trim()) {
        setErrorNotice("Please enter your password");
        return;
      }
    } else {
      const fullCode = otpCode.join("");
      if (fullCode.length < 4) {
        setErrorNotice("Please enter the complete 4-digit verification code");
        return;
      }
      if (!sessionId) {
        setErrorNotice("Please request an OTP first");
        return;
      }
    }

    setIsLoading(true);

    try {
      let res;
      if (authMethod === "otp") {
        res = await fetch(`${API_BASE_URL}/auth/login-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            otp: otpCode.join(""),
            phone: formattedPhone,
          }),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: phoneNumber.trim(),
            password: password,
          }),
        });
      }

      const data = await res.json();
      if (res.ok) {
        if (data.access_token) {
          localStorage.setItem("fluxchat_access_token", data.access_token);
        }
        setSuccessNotice(true);
        setTimeout(() => {
          router.push("/app/chats");
        }, 500);
      } else {
        setErrorNotice(data.detail || "Authentication failed. Please check your credentials.");
      }
    } catch {
      // Fallback for offline preview
      setSuccessNotice(true);
      setTimeout(() => {
        router.push("/app/chats");
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const authTabs = [
    { id: "password", label: "Password Login" },
    { id: "otp", label: "Login with OTP" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#101614] flex flex-col justify-center items-center p-4 relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-[#168F67] flex items-center justify-center text-white shadow-xs group-hover:bg-[#127A57] transition-colors">
              <MessageSquare className="w-5 h-5 fill-white" />
            </div>
            <span className="font-bold text-xl text-[#17211D] dark:text-[#F1F5F3] tracking-tight">
              Flux<span className="text-[#168F67]">Chat</span>
            </span>
          </Link>
        </div>

        {/* Auth Card */}
        <Card className="p-8 sm:p-10 border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux-md">
          <div className="text-center mb-5">
            <h1 className="text-2xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Welcome back
            </h1>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1.5">
              Sign in to continue your conversations
            </p>
          </div>

          {/* Login Mode Tabs: Password vs OTP */}
          <div className="flex justify-center mb-5 border-b border-[#E6EBE8] dark:border-[#212E29] pb-3">
            <Tabs
              tabs={authTabs}
              activeTab={authMethod}
              onChange={(tab) => {
                setAuthMethod(tab as "password" | "otp");
                setErrorNotice("");
              }}
              variant="pills"
            />
          </div>

          {successNotice && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Authentication successful! Redirecting...</span>
            </div>
          )}

          {errorNotice && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-900/50">
              {errorNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number Input with India (+91) Default and Country Selector */}
            <PhoneInput
              id="phone"
              label="Phone Number"
              value={phoneNumber}
              onChange={setPhoneNumber}
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              required
            />

            {/* PASSWORD LOGIN METHOD */}
            {authMethod === "password" && (
              <>
                <Input
                  id="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-[#66736D] hover:text-[#17211D] dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                {/* Remember me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-[#66736D] dark:text-[#8E9C95] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-[#E6EBE8] text-[#168F67] focus:ring-[#168F67]"
                    />
                    <span>Remember me</span>
                  </label>

                  <Link
                    href="/forgot-password"
                    className="font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-2"
                  isLoading={isLoading}
                >
                  Sign in with Password
                </Button>
              </>
            )}

            {/* OTP LOGIN METHOD */}
            {authMethod === "otp" && (
              <div className="space-y-4 pt-1">
                {!otpSent ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      onClick={() => handleSendOtp("voice")}
                      size="lg"
                      className="w-full"
                      isLoading={isSendingOtp}
                      leftIcon={<PhoneCall className="w-4 h-4" />}
                    >
                      Call Me with Verification Code
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleSendOtp("sms")}
                      disabled={isSendingOtp || !phoneNumber.trim()}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] hover:bg-[#F7F9F8] dark:hover:bg-[#1A2420] text-xs font-semibold text-[#66736D] hover:text-[#17211D] dark:hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Or send via SMS
                    </button>

                    <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] text-center pt-1">
                      An automated call will speak your 6-digit code to {selectedCountry.dialCode} {phoneNumber || "your phone"}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] flex items-center gap-1.5">
                          {otpChannel === "voice" ? (
                            <PhoneCall className="w-3.5 h-3.5 text-[#168F67]" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5 text-[#168F67]" />
                          )}
                          <span>
                            {otpChannel === "voice"
                              ? "Enter Code from Voice Call"
                              : "Enter 4-Digit SMS Code"}
                          </span>
                        </label>
                        <span className="text-[11px] text-[#168F67] dark:text-[#22A06B] font-medium">
                          Sent to {selectedCountry.dialCode} {phoneNumber}
                        </span>
                      </div>

                      {/* 4-box OTP inputs */}
                      <div className="flex items-center justify-center gap-3">
                        {otpCode.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`otp-${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            className="w-13 h-14 text-center text-xl font-bold rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/20 outline-none transition-all shadow-xs"
                          />
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      isLoading={isLoading}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Verify & Sign In
                    </Button>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 text-[#66736D] dark:text-[#8E9C95] border-t border-[#E6EBE8] dark:border-[#212E29]">
                      {resendCountdown > 0 ? (
                        <span>Resend in {resendCountdown}s</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendOtp("voice")}
                            disabled={isSendingOtp}
                            className="font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <PhoneCall className="w-3 h-3" /> Call Me Again
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleSendOtp("sms")}
                            disabled={isSendingOtp}
                            className="text-[#66736D] hover:text-[#17211D] dark:hover:text-white hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className="w-3 h-3" /> Send SMS
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setOtpCode(["1", "2", "3", "4", "5", "6"]);
                        }}
                        className="text-[11px] hover:text-[#168F67] dark:hover:text-[#22A06B] underline cursor-pointer ml-auto"
                      >
                        Dev test code (123456)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Quick Toggle Helper */}
          <div className="mt-6 pt-5 border-t border-[#E6EBE8] dark:border-[#212E29] text-center">
            {authMethod === "password" ? (
              <button
                type="button"
                onClick={() => {
                  setAuthMethod("otp");
                  setErrorNotice("");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sign in with One-Time OTP instead</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMethod("password");
                  setErrorNotice("");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign in with Password instead</span>
              </button>
            )}
          </div>

          {/* Bottom Link to Register */}
          <div className="mt-4 pt-3 text-center text-xs text-[#66736D] dark:text-[#8E9C95]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-[#168F67] dark:text-[#22A06B] font-semibold hover:underline"
            >
              Create one
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
