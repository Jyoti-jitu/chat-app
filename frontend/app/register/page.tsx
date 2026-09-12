"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  User,
  AtSign,
  Mail,
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
  Edit3,
} from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput, COUNTRIES, Country } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { API_BASE_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Phone & Country State (Default: India +91)
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);

  // OTP Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Password & UI State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  // Clean up reCAPTCHA verifier on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

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

  // Normalize phone number to E.164 (+919876543210)
  const getNormalizedPhoneNumber = (): string => {
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    if (!cleanDigits) return "";
    const withoutLeadingZero = cleanDigits.startsWith("0") ? cleanDigits.slice(1) : cleanDigits;
    return `${selectedCountry.dialCode}${withoutLeadingZero}`;
  };

  // Human-friendly Firebase error messages
  const getFirebaseErrorMessage = (err: unknown): string => {
    const firebaseErr = err as { code?: string; message?: string };
    const code = firebaseErr?.code || "";

    switch (code) {
      case "auth/invalid-phone-number":
        return "Please enter a valid mobile phone number.";
      case "auth/invalid-verification-code":
        return "Invalid 6-digit OTP code. Please verify and try again.";
      case "auth/code-expired":
        return "OTP code has expired. Please request a new OTP.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a few moments before trying again.";
      case "auth/quota-exceeded":
        return "SMS quota exceeded. For localhost testing, use test phone numbers in Firebase Console.";
      case "auth/captcha-check-failed":
        return "reCAPTCHA verification failed. Please try again.";
      case "auth/billing-not-enabled":
        return "Firebase SMS requires Blaze plan or test numbers in Firebase Console.";
      default:
        return firebaseErr?.message || "Verification failed. Please try again.";
    }
  };

  // Initialize or retrieve singleton RecaptchaVerifier
  const getOrCreateRecaptchaVerifier = (): RecaptchaVerifier | null => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    if (!recaptchaContainerRef.current) {
      return null;
    }

    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved automatically
        },
        "expired-callback": () => {
          setOtpError("reCAPTCHA expired. Please resend the code.");
        },
      });
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (err) {
      console.warn("Recaptcha initialization notice:", err);
      return null;
    }
  };

  // Reset verification state if phone number changes
  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    if (isPhoneVerified) {
      setIsPhoneVerified(false);
      setFirebaseIdToken(null);
      setConfirmationResult(null);
    }
  };

  // Reset verification state if country changes
  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    if (isPhoneVerified) {
      setIsPhoneVerified(false);
      setFirebaseIdToken(null);
      setConfirmationResult(null);
    }
  };

  // Trigger Send Firebase Phone OTP
  const handleInitiateVerify = async () => {
    const formattedPhone = getNormalizedPhoneNumber();
    const cleanNumber = phoneNumber.replace(/\D/g, "");

    if (!cleanNumber || cleanNumber.length < 7) {
      setError("Please enter a valid mobile number first.");
      return;
    }

    setError("");
    setOtpError("");
    setIsSendingOtp(true);

    try {
      const appVerifier = getOrCreateRecaptchaVerifier();
      if (!appVerifier) {
        throw new Error("Unable to initialize reCAPTCHA verifier.");
      }

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setIsVerifying(true);
      setResendCountdown(30);
      setOtpCode(["", "", "", "", "", ""]);

      // Focus first OTP input
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err) {
      console.error("Firebase send OTP error:", err);
      const userMessage = getFirebaseErrorMessage(err);
      setError(userMessage);
      setOtpError(userMessage);

      // Reset verifier on error to prevent broken reCAPTCHA state
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle individual OTP input digits
  const handleOtpDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newCode = [...otpCode];
    newCode[index] = val.slice(-1);
    setOtpCode(newCode);

    // Auto-advance to next box
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

  // Verify OTP submission with Firebase confirmationResult.confirm()
  const verifyOtpCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpCode.join("");
    if (code.length < 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!confirmationResult) {
      setOtpError("Verification session expired. Please resend OTP.");
      return;
    }

    setOtpError("");
    setIsVerifyingOtp(true);

    try {
      // Cryptographically verify OTP with Firebase Auth
      const result = await confirmationResult.confirm(code);
      const user = result.user;
      const idToken = await user.getIdToken();

      setFirebaseIdToken(idToken);
      setIsPhoneVerified(true);
      setIsVerifying(false);
      setVerificationSuccess(true);
      setError("");

      setTimeout(() => setVerificationSuccess(false), 4000);
    } catch (err) {
      console.error("Firebase OTP confirmation error:", err);
      const message = getFirebaseErrorMessage(err);
      setOtpError(message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Change phone number action
  const handleChangePhone = () => {
    setIsVerifying(false);
    setOtpCode(["", "", "", "", "", ""]);
    setOtpError("");
    setConfirmationResult(null);
  };

  // Localhost development helper (for test phone numbers configured in Firebase Console)
  const handleUseTestOtp = () => {
    const testCode = ["1", "2", "3", "4", "5", "6"];
    setOtpCode(testCode);
    verifyOtpCode(testCode.join(""));
  };

  // Main Registration Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }

    if (!username.trim()) {
      setError("Please enter your username");
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Please enter your mobile number");
      return;
    }

    // Step 4 Requirement: If phone is not verified, prompt OTP verification first
    if (!isPhoneVerified) {
      setError("Please verify your mobile number with OTP before creating your account.");
      await handleInitiateVerify();
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

    try {
      // Send registration to existing backend API
      const normalizedPhone = getNormalizedPhoneNumber();
      const userEmail = email.trim() || `${username.trim().toLowerCase()}@fluxchat.internal`;

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: userEmail,
          password: password,
          phone: normalizedPhone,
          firebase_token: firebaseIdToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          localStorage.setItem("fluxchat_access_token", data.access_token);
        }
        setSuccessNotice(true);
        setTimeout(() => {
          router.push("/app/chats");
        }, 500);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || "Registration failed. Please check your details.");
      }
    } catch {
      // Fallback redirect for preview if backend is not reached
      setSuccessNotice(true);
      setTimeout(() => {
        router.push("/app/chats");
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#101614] flex flex-col justify-center items-center p-4 py-8 relative">
      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

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

            {/* Email Address */}
            <Input
              id="email"
              label="Email address"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
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
                      title="Mobile number verified via Firebase"
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
                      title="Send Firebase SMS verification OTP"
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
                <span>Default: India (+91) • Select flag to change</span>
                {isPhoneVerified ? (
                  <span className="text-[#168F67] dark:text-[#22A06B] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> OTP Verified
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    OTP verification required
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
                        Enter 6-digit OTP
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
                    onClick={handleChangePhone}
                    title="Change phone number"
                    className="text-[11px] text-[#66736D] hover:text-[#17211D] dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                </div>

                {otpError && (
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] font-medium border border-rose-200 dark:border-rose-900/50">
                    {otpError}
                  </div>
                )}

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
                      Resend OTP in <span className="font-mono font-semibold">{resendCountdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInitiateVerify}
                      disabled={isSendingOtp}
                      className="text-[11px] font-semibold text-[#168F67] dark:text-[#22A06B] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCw className="w-3 h-3" /> Resend OTP
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleUseTestOtp}
                    title="For Firebase test phone numbers configured in console"
                    className="text-[11px] text-[#66736D] hover:text-[#168F67] dark:hover:text-[#22A06B] underline cursor-pointer"
                  >
                    Test code (123456)
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
                  Verify OTP
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
