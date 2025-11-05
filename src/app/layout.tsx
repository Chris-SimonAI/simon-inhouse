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
    "Meet Simon, your personal AI concierge for the finest local recommendations, curated experiences, and exclusive hotel services while you enjoy your stay here.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh h-dvh w-full bg-gray-50 max-w-md mx-auto relative`}
      >
        <div className="flex justify-center items-center h-full w-full">
          <div className="h-dvh w-full max-w-md bg-white">
            {children}
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
