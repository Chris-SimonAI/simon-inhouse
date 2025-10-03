import { getHotelById } from "@/actions/hotels";
import { DEFAULT_HOTEL_ID } from "@/constants";
import WelcomeClient from "@/components/WelcomeClient.tsx";
import { Suspense } from "react";

async function WelcomeContent() {
  const hotelResult = await getHotelById(DEFAULT_HOTEL_ID);
  if (!hotelResult.ok || !hotelResult.data) {
    throw new Error(`Failed to fetch hotel: ${hotelResult.message}`);
  }

  return <WelcomeClient hotel={hotelResult.data} />;
}

export default function WelcomeOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
