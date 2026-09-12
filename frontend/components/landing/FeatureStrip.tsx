"use client";

import React from "react";
import { MessageSquare, Users, ShieldCheck, Smartphone } from "lucide-react";

export function FeatureStrip() {
  const features = [
    {
      icon: <MessageSquare className="w-5 h-5 text-[#168F67] dark:text-[#22A06B]" />,
      title: "Real-time Messaging",
      description: "Instant delivery with live indicators and typing feedback.",
    },
    {
      icon: <Users className="w-5 h-5 text-[#168F67] dark:text-[#22A06B]" />,
      title: "Group Chats",
      description: "Collaborative channels for friends, family, and teams.",
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#168F67] dark:text-[#22A06B]" />,
      title: "End-to-end Security",
      description: "Encrypted transmissions ensuring your data stays private.",
    },
    {
      icon: <Smartphone className="w-5 h-5 text-[#168F67] dark:text-[#22A06B]" />,
      title: "Available Everywhere",
      description: "Fluidly responsive across phones, tablets, and desktop.",
    },
  ];

  return (
    <section id="features" className="border-t border-[#E6EBE8] dark:border-[#212E29] bg-[#F7F9F8] dark:bg-[#151D1A]/50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[#E6EBE8] dark:lg:divide-[#212E29]">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-4 px-0 lg:px-6">
              <div className="w-10 h-10 rounded-full bg-[#EAF5F0] dark:bg-[rgba(34,160,107,0.18)] flex items-center justify-center shrink-0">
                {feature.icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                  {feature.title}
                </h3>
                <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
