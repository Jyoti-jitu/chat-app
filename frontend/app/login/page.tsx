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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput, COUNTRIES, Country } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tabs } from "@/components/ui/Tabs";

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // India (+91) default
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

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

  // Handle Send OTP
  const handleSendOtp = () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 6) {
      setErrorNotice("Please enter a valid phone number");
      return;
    }
    setErrorNotice("");
    setIsSendingOtp(true);

    setTimeout(() => {
      setIsSendingOtp(false);
      setOtpSent(true);
      setResendCountdown(30);
    }, 600);
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
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

  // Submit handler (Password or OTP)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice("");

    if (authMethod === "password") {
      if (!phoneNumber.trim()) {
        setErrorNotice("Please enter your phone number");
        return;
      }
      if (!password.trim()) {
        setErrorNotice("Please enter your password");
        return;
      }
    } else {
      const fullCode = otpCode.join("");
      if (fullCode.length < 6) {
        setErrorNotice("Please enter the complete 6-digit verification code");
        return;
      }
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessNotice(true);
      setTimeout(() => {
        router.push("/app/chats");
      }, 500);
    }, 600);
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
                  <div>
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      size="lg"
                      className="w-full"
                      isLoading={isSendingOtp}
                      leftIcon={<KeyRound className="w-4 h-4" />}
                    >
                      Send Verification Code (OTP)
                    </Button>
                    <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95] text-center mt-2">
                      We will send an SMS with a 6-digit one-time code to {selectedCountry.dialCode} {phoneNumber || "your phone"}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                          Enter 6-Digit Code
                        </label>
                        <span className="text-[11px] text-[#168F67] dark:text-[#22A06B] font-medium">
                          Sent to {selectedCountry.dialCode} {phoneNumber}
                        </span>
                      </div>

                      {/* 6-box OTP inputs */}
                      <div className="flex items-center justify-between gap-2">
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
                            className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] text-[#17211D] dark:text-[#F1F5F3] focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/20 outline-none transition-all shadow-xs"
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

                    <div className="flex items-center justify-between text-xs pt-1 text-[#66736D] dark:text-[#8E9C95]">
                      {resendCountdown > 0 ? (
                        <span>Resend code in {resendCountdown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline cursor-pointer"
                        >
                          Resend OTP code
                        </button>
                      )}

                      <Link
                        href="/forgot-password"
                        className="font-medium text-[#66736D] dark:text-[#8E9C95] hover:text-[#168F67]"
                      >
                        Trouble logging in?
                      </Link>
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
