import { getHotelById } from "@/actions/hotels";
import { DEFAULT_HOTEL_ID } from "@/constants";
import VoiceIntroClient from "@/components/VoiceIntroClient.tsx";
import { Suspense } from "react";

async function VoiceIntroContent() {
  const hotelResult = await getHotelById(DEFAULT_HOTEL_ID);
  if (!hotelResult.ok || !hotelResult.data) {
    throw new Error(`Failed to fetch hotel: ${hotelResult.message}`);
  }

  return <VoiceIntroClient hotel={hotelResult.data} />;
}

export default function VoiceIntroPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <span className="ml-3 text-gray-600">Loading ...</span>
        </div>
      }
    >
      <VoiceIntroContent />
    </Suspense>
  );
}
