import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FluxChat — Conversations for a brighter tomorrow",
  description:
    "A simple, secure and beautiful way to stay connected with the people who matter most. Built with Next.js and Tailwind CSS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('fluxchat_theme');
                const isDark = storedTheme === 'dark' || (storedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
                const storedAccent = localStorage.getItem('fluxchat_accent');
                if (storedAccent) {
                  document.documentElement.style.setProperty('--primary', storedAccent);
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] antialiased selection:bg-[var(--primary)]/20 selection:text-[var(--primary)] flex flex-col`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
