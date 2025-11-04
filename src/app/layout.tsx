import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meet Simon",
  description:
    "Meet Simon, your personal AI concierge for curated recommendations, exclusive hotel services, and local experiences.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh h-dvh w-full bg-gray-50`}
      >
        {/* 
          Outer shell with centered content and consistent sizing.
          Mirrors old AppWrapper structure.
        */}
        <div className="flex justify-center items-center h-full w-full">
          <div className="h-dvh w-full max-w-md bg-white">
            {children}
          </div>
        </div>

        {/* Global toast notifications */}
        <Toaster />
      </body>
    </html>
  );
}
