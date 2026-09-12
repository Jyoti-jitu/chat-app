"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳", placeholder: "98765 43210" },
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸", placeholder: "(555) 000-0000" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧", placeholder: "7911 123456" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦", placeholder: "(555) 000-0000" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺", placeholder: "412 345 678" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪", placeholder: "50 123 4567" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬", placeholder: "8123 4567" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦", placeholder: "50 123 4567" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪", placeholder: "151 23456789" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵", placeholder: "90 1234 5678" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷", placeholder: "(11) 98765-4321" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦", placeholder: "71 123 4567" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬", placeholder: "802 123 4567" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰", placeholder: "300 1234567" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "🇧🇩", placeholder: "1712 345678" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩", placeholder: "812 3456 7890" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽", placeholder: "55 1234 5678" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹", placeholder: "312 345 6789" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱", placeholder: "6 12345678" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿", placeholder: "21 123 4567" },
  { name: "Nepal", code: "NP", dialCode: "+977", flag: "🇳🇵", placeholder: "9841 234567" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰", placeholder: "71 234 5678" },
];

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  selectedCountry?: Country;
  onCountryChange?: (country: Country) => void;
  className?: string;
  rightAction?: React.ReactNode;
}

export function PhoneInput({
  value,
  onChange,
  label = "Phone Number",
  error,
  id = "phone-input",
  required = false,
  disabled = false,
  selectedCountry: controlledCountry,
  onCountryChange,
  className,
  rightAction,
}: PhoneInputProps) {
  // Default is India (+91)
  const [internalCountry, setInternalCountry] = useState<Country>(COUNTRIES[0]);
  const currentCountry = controlledCountry || internalCountry;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectCountry = (country: Country) => {
    setInternalCountry(country);
    onCountryChange?.(country);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("w-full space-y-1.5 text-left", className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-[#17211D] dark:text-[#F1F5F3]"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center" ref={dropdownRef}>
        {/* Country Selector Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={`Select country code (current: ${currentCountry.name} ${currentCountry.dialCode})`}
          className="h-10.5 px-3 flex items-center gap-1.5 rounded-l-xl bg-[#F7F9F8] dark:bg-[#1D2723] border border-r-0 border-[#E6EBE8] dark:border-[#212E29] text-xs font-bold text-[#17211D] dark:text-[#F1F5F3] hover:bg-[#EAF5F0] dark:hover:bg-[#25352E] transition-colors cursor-pointer shrink-0"
        >
          <span className="text-base leading-none select-none">{currentCountry.flag}</span>
          <span className="font-semibold text-xs text-[#17211D] dark:text-[#F1F5F3]">
            {currentCountry.dialCode}
          </span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-[#66736D] dark:text-[#8E9C95] transition-transform duration-150",
              isOpen ? "rotate-180 text-[#168F67]" : ""
            )}
          />
        </button>

        {/* Phone digits input */}
        <input
          id={id}
          type="tel"
          disabled={disabled}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={currentCountry.placeholder}
          className={cn(
            "w-full h-10.5 bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] px-3.5 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D]",
            rightAction ? "rounded-none border-r-0" : "rounded-r-xl",
            "focus:outline-none focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/20 transition-all shadow-xs",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
          )}
        />

        {/* Optional Right Action (e.g. Verify button or Verified badge) */}
        {rightAction && <div className="shrink-0 flex items-center">{rightAction}</div>}

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-12 left-0 z-50 w-72 max-h-72 rounded-2xl bg-white dark:bg-[#17211D] border border-[#E6EBE8] dark:border-[#212E29] shadow-flux-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input inside dropdown */}
            <div className="p-2.5 border-b border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8] dark:bg-[#151D1A]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#66736D] dark:text-[#8E9C95] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search country or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#1D2723] border border-[#E6EBE8] dark:border-[#212E29] text-[#17211D] dark:text-[#F1F5F3] focus:outline-none focus:border-[#168F67]"
                />
              </div>
            </div>

            {/* Country list */}
            <div className="flex-1 overflow-y-auto p-1 divide-y divide-[#E6EBE8]/40 dark:divide-[#212E29]/40">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => {
                  const isSelected = country.code === currentCountry.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleSelectCountry(country)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left",
                        isSelected
                          ? "bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.2)] text-[#168F67] dark:text-[#22A06B] font-bold"
                          : "hover:bg-[#F7F9F8] dark:hover:bg-[#1D2723] text-[#17211D] dark:text-[#F1F5F3]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg leading-none shrink-0 select-none">
                          {country.flag}
                        </span>
                        <span className="truncate">{country.name}</span>
                        {country.code === "IN" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#168F67]/15 text-[#168F67] dark:text-[#22A06B] font-semibold shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#66736D] dark:text-[#8E9C95] shrink-0 ml-2">
                        {country.dialCode}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-[#66736D] dark:text-[#8E9C95]">
                  No countries found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
