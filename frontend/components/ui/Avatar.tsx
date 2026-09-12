import React from "react";
import { cn } from "@/lib/utils/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  isOnline?: boolean;
}

const colorPairs = [
  "from-emerald-500 to-teal-700",
  "from-teal-600 to-emerald-700",
  "from-cyan-600 to-teal-800",
  "from-emerald-600 to-green-700",
  "from-teal-500 to-emerald-600",
];

export function Avatar({
  src,
  name = "User",
  size = "md",
  isOnline,
  className,
  ...props
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Derive stable gradient based on name string
  const colorIndex =
    name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    colorPairs.length;

  const sizeStyles = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
    "2xl": "w-24 h-24 text-3xl",
  };

  const statusDotSizes = {
    xs: "w-2 h-2",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
    xl: "w-4 h-4",
    "2xl": "w-5 h-5",
  };

  return (
    <div className={cn("relative inline-block select-none shrink-0", className)} {...props}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold text-white overflow-hidden shadow-sm",
          `bg-gradient-to-br ${colorPairs[colorIndex]}`,
          sizeStyles[size]
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {typeof isOnline === "boolean" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-[#151D1A]",
            statusDotSizes[size],
            isOnline ? "bg-[#22A06B]" : "bg-[#9BA7A1]"
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
