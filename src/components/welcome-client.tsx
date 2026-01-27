"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { Hotel } from "@/db/schemas/hotels";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { Analytics } from "@/lib/analytics/client";

type WelcomeClientProps = {
  hotel: Hotel;
};

export default function WelcomeClient({ hotel }: WelcomeClientProps) {
  const router = useRouter();

  const slug = useHotelSlug();

  const meetSimon = useCallback(() => {
    Analytics.capture(AnalyticsEvents.meetSimonIntroButtonClicked);
    router.push(`/${slug}?voice=true`);
  }, [router, slug]);

  const skipIntro = useCallback(() => {
    document.cookie = "simon-intro-played=true; path=/";
    router.push(`/${slug}`);
    router.refresh();
  }, [router, slug]);
  
  return (
    <div className="h-dvh w-full bg-gray-50">
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md flex items-center justify-center relative">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{
              backgroundImage: 'url(/hotel/anza-bedroom.jpg)',
              backgroundPosition: 'left center',
              backgroundSize: '200% 100%',
            }}
          />
          
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-3">
              Welcome
            </h1>
            <h2 className="text-2xl font-medium text-gray-700 mb-8">
              To the {hotel.name}
            </h2>
            <p className="text-xl font-medium text-gray-700">
              Simon is your
            </p>
            <p className="text-xl font-medium text-gray-700 mb-8">
              personal concierge
            </p>
            <p className="text-xl font-medium text-gray-700 mb-6">
              Tap to meet Simon
            </p>
            <Button
              onClick={meetSimon}
              className="bg-gray-800 text-white hover:bg-gray-900 rounded-lg px-8 py-6 text-base font-medium"
            >
              Meet Simon
            </Button>
            <button
              onClick={skipIntro}
              className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
            >
              Skip to ordering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
