"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { type Hotel } from "@/db/schemas/hotels";

type WelcomeClientProps = {
  hotel: Hotel;
};

export default function WelcomeClient({ hotel }: WelcomeClientProps) {
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
    <div className="h-dvh w-full bg-gray-50">
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md flex items-center justify-center bg-white">
          <div className="flex flex-col items-center text-center px-6">
            <h1 className="text-[30px] font-normal text-gray-600 mb-6">
              Welcome to {hotel.name}!
            </h1>
            <p className="text-base text-[30px] font-normal text-gray-600">
              Simon is your personal
            </p>
            <p className="text-base text-[30px] font-normal text-gray-600 mb-6">
              concierge
            </p>
            <p className="text-sm text-[30px] font-normal text-gray-600 mb-6">
              Tap to Meet Simon
            </p>
            <Button 
              onClick={meetSimon}
              className="bg-black text-white hover:bg-gray-800 rounded-md px-8 py-3 text-sm font-medium mb-4"
            >
              Meet Simon
            </Button>
            {/* <Button 
              onClick={skipIntro}
              variant="ghost"
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm"
            >
              Skip Intro
            </Button> */}
          </div>
        </div>
      </div>
    </div>
  );
}
