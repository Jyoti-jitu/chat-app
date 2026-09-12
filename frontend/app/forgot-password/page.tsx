"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, Mail, ArrowLeft, Send, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneInput, COUNTRIES, Country } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function ForgotPasswordPage() {
  const [resetMethod, setResetMethod] = useState<"phone" | "email">("phone");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default India (+91)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 600);
  };

  const targetRecipient =
    resetMethod === "phone" ? `${selectedCountry.dialCode} ${phoneNumber}` : email;

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

        {/* Card */}
        <Card className="p-8 sm:p-10 border-[#E6EBE8] dark:border-[#212E29] bg-white dark:bg-[#151D1A] shadow-flux-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
              Reset your password
            </h1>
            <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1.5 max-w-xs mx-auto leading-relaxed">
              {resetMethod === "phone"
                ? "Enter your registered phone number to receive an SMS verification code."
                : "Enter your registered email address to receive a password reset link."}
            </p>
          </div>

          {isSent ? (
            <div className="text-center space-y-4 py-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] text-[#168F67] dark:text-[#22A06B] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                Verification code sent!
              </p>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95]">
                We sent instructions to{" "}
                <span className="font-semibold text-[#17211D] dark:text-[#F1F5F3]">
                  {targetRecipient}
                </span>
                . Please check your messages.
              </p>
              <Link href="/login" className="inline-block pt-2">
                <Button size="sm">Return to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {resetMethod === "phone" ? (
                <PhoneInput
                  id="resetPhone"
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  selectedCountry={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  required
                />
              ) : (
                <div>
                  <label
                    htmlFor="resetEmail"
                    className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] mb-1.5 text-left"
                  >
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3.5 text-[#66736D] pointer-events-none" />
                    <input
                      id="resetEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] pl-10 pr-4 py-2.5 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/20 transition-all shadow-xs"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<Send className="w-4 h-4" />}
              >
                Send reset code
              </Button>

              {/* Toggle reset method */}
              <div className="text-center pt-1">
                {resetMethod === "phone" ? (
                  <button
                    type="button"
                    onClick={() => setResetMethod("email")}
                    className="text-xs text-[#168F67] dark:text-[#22A06B] font-medium hover:underline cursor-pointer"
                  >
                    Reset using email address instead
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResetMethod("phone")}
                    className="text-xs text-[#168F67] dark:text-[#22A06B] font-medium hover:underline cursor-pointer"
                  >
                    Reset using phone number instead
                  </button>
                )}
              </div>

              <div className="text-center pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#66736D] dark:text-[#8E9C95] hover:text-[#17211D] dark:hover:text-[#F1F5F3] font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to sign in</span>
                </Link>
              </div>
            </form>
          )}

          {/* Decorative Badge */}
          <div className="mt-8 pt-6 border-t border-[#E6EBE8] dark:border-[#212E29] flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-900/30 flex items-center justify-center text-[#168F67] dark:text-[#22A06B] shadow-xs">
              <Phone className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3] italic">
              We&apos;ll get you back in no time ✨
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
