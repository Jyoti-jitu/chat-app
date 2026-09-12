"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  User,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  RotateCw,
  Smartphone,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput, COUNTRIES, Country } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  // Phone & Country State (Default: India +91)
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // OTP Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Password & Form State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle phone change - resets verification if number is altered
  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    if (isPhoneVerified) {
      setIsPhoneVerified(false);
    }
  };

  // Handle country change
  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    if (isPhoneVerified) {
      setIsPhoneVerified(false);
    }
  };

  // Trigger Send OTP / Open Verification
  const handleInitiateVerify = () => {
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber || cleanNumber.length < 7) {
      setError("Please enter a valid mobile number first");
      return;
    }

    setError("");
    setIsSendingOtp(true);

    setTimeout(() => {
      setIsSendingOtp(false);
      setIsVerifying(true);
      setResendCountdown(30);
      setOtpCode(["", "", "", "", "", ""]);
      // Focus first OTP input
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }, 500);
  };

  // Handle individual OTP input digits
  const handleOtpDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newCode = [...otpCode];
    newCode[index] = val.slice(-1);
    setOtpCode(newCode);

    // Auto advance to next box
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits entered
    if (val && index === 5 && newCode.every((d) => d !== "")) {
      verifyOtpCode(newCode.join(""));
    }
  };

  // Handle Backspace navigation in OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste in OTP input
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newCode = [...otpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pastedData[i] || "";
    }
    setOtpCode(newCode);

    if (pastedData.length === 6) {
      verifyOtpCode(pastedData);
    } else {
      otpInputRefs.current[Math.min(pastedData.length, 5)]?.focus();
    }
  };

  // Verify OTP submission
  const verifyOtpCode = (codeToVerify?: string) => {
    const code = codeToVerify || otpCode.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }

    setError("");
    setIsVerifyingOtp(true);

    setTimeout(() => {
      setIsVerifyingOtp(false);
      setIsPhoneVerified(true);
      setIsVerifying(false);
      setVerificationSuccess(true);
      setTimeout(() => setVerificationSuccess(false), 4000);
    }, 600);
  };

  // Fill demo OTP
  const handleUseDemoOtp = () => {
    const demoCode = ["1", "2", "3", "4", "5", "6"];
    setOtpCode(demoCode);
    verifyOtpCode(demoCode.join(""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phoneNumber.trim()) {
      setError("Please enter your mobile number");
      return;
    }

    if (!isPhoneVerified) {
      setError("Please click 'Verify' to verify your mobile number before proceeding");
      setIsVerifying(true);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service");
      return;
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

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#101614] flex flex-col justify-center items-center p-4 py-8 relative">
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

        {/* Card */}
        <Card className="p-8 sm:p-10 border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Create your account
            </h1>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1.5">
              Join FluxChat with your verified mobile number
            </p>
          </div>

          {successNotice && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Account created! Redirecting to chats...</span>
            </div>
          )}

          {verificationSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Mobile number ({selectedCountry.dialCode} {phoneNumber}) verified!</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <Input
              id="fullname"
              label="Full name"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              leftIcon={<User className="w-4 h-4" />}
            />

            {/* Username */}
            <Input
              id="username"
              label="Username"
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              leftIcon={<AtSign className="w-4 h-4" />}
            />

            {/* Mobile Number with Country Code (Default: India +91) & Verify Button */}
            <div className="space-y-1.5">
              <PhoneInput
                id="mobile"
                label="Mobile Number"
                value={phoneNumber}
                onChange={handlePhoneChange}
                selectedCountry={selectedCountry}
                onCountryChange={handleCountryChange}
                required
                rightAction={
                  isPhoneVerified ? (
                    <div
                      title="Mobile number verified"
                      className="h-10.5 px-3 rounded-r-xl bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] border border-[#168F67]/30 text-[#168F67] dark:text-[#22A06B] font-semibold text-xs flex items-center gap-1.5 select-none shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#168F67] dark:text-[#22A06B]" />
                      <span className="hidden sm:inline font-medium">Verified</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInitiateVerify}
                      disabled={isSendingOtp || !phoneNumber.trim()}
                      title="Verify your mobile number via SMS OTP"
                      className="h-10.5 px-3.5 rounded-r-xl bg-[#168F67] hover:bg-[#127A57] active:scale-[0.98] text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0 shadow-xs border border-[#168F67]"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </>
                      )}
                    </button>
                  )
                }
              />

              {/* Status helper under mobile field */}
              <div className="flex items-center justify-between text-[11px] px-1 text-[#66736D] dark:text-[#8E9C95]">
                <span>Default: India (+91) • Select country to change</span>
                {isPhoneVerified ? (
                  <span className="text-[#168F67] dark:text-[#22A06B] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Verification required
                  </span>
                )}
              </div>
            </div>

            {/* Verification OTP Box (Expands when Verify is clicked) */}
            {isVerifying && !isPhoneVerified && (
              <div className="p-4 rounded-2xl bg-[#F7F9F8] dark:bg-[#1A2420] border border-[#168F67]/30 dark:border-[#168F67]/40 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#168F67]/15 flex items-center justify-center text-[#168F67]">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#17211D] dark:text-[#F1F5F3]">
                        Enter Verification Code
                      </h4>
                      <p className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                        Sent to{" "}
                        <span className="font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                          {selectedCountry.dialCode} {phoneNumber}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVerifying(false)}
                    className="text-[11px] text-[#66736D] hover:text-[#17211D] dark:hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                {/* 6 Digit Inputs */}
                <div className="flex justify-between gap-1.5 py-1">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      id={`register-otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-10 h-11 text-center font-bold text-base rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/20 transition-all"
                    />
                  ))}
                </div>

                {/* OTP Action Bar */}
                <div className="flex items-center justify-between text-xs pt-1">
                  {resendCountdown > 0 ? (
                    <span className="text-[11px] text-[#66736D] dark:text-[#8E9C95]">
                      Resend in <span className="font-mono font-semibold">{resendCountdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInitiateVerify}
                      className="text-[11px] font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" /> Resend OTP
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleUseDemoOtp}
                    className="text-[11px] text-[#66736D] hover:text-[#168F67] dark:hover:text-[#22A06B] underline cursor-pointer"
                  >
                    Use test code (123456)
                  </button>
                </div>

                {/* Confirm Code Button */}
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => verifyOtpCode()}
                  isLoading={isVerifyingOtp}
                  className="w-full text-xs h-9"
                >
                  Confirm & Verify Mobile
                </Button>
              </div>
            )}

            {/* Password */}
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

            {/* Confirm Password */}
            <Input
              id="confirmPassword"
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Terms checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2 text-xs text-[#66736D] dark:text-[#8E9C95] cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#E6EBE8] text-[#168F67] focus:ring-[#168F67]"
                />
                <span>
                  I agree to the{" "}
                  <span className="text-[#168F67] dark:text-[#22A06B] font-medium hover:underline">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="text-[#168F67] dark:text-[#22A06B] font-medium hover:underline">
                    Privacy Policy
                  </span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full mt-3 flex items-center justify-center gap-2"
              isLoading={isLoading}
            >
              <span>Create account</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Footer link */}
          <div className="mt-6 pt-4 border-t border-[#E6EBE8] dark:border-[#212E29] text-center text-xs text-[#66736D] dark:text-[#8E9C95]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#168F67] dark:text-[#22A06B] font-semibold hover:underline"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
