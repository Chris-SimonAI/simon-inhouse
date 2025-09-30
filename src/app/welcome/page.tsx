"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";

export default function WelcomeOnboardingPage() {
  const router = useRouter();

  const meetSimon = useCallback(() => {
    router.push("/welcome/voice");
  }, [router]);

  const skipIntro = useCallback(() => {
    // Set cookie for 1 day and return to home
    const maxAge = 24 * 60 * 60; // 1 day
    document.cookie = `simon-intro-played=true; max-age=${maxAge}; path=/`;
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm text-center border border-gray-300 rounded-lg py-16">
        <h1 className="text-2xl font-semibold text-gray-800">Welcome to Hotel Pacifica!</h1>
        <p className="mt-6 text-gray-700">Simon is your personal concierge</p>
        <p className="mt-6 text-gray-700">Tap to Meet Simon</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button className="w-36" onClick={meetSimon}>
            Meet Simon
          </Button>
          <Button className="w-36" variant="outline" onClick={skipIntro}>
            Skip Intro
          </Button>
        </div>
      </div>
    </div>
  );
}
