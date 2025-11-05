"use client";

import { TipStaffScreen } from "@/components/tip-staff-screen";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface TipStaffClientProps {
  hotel: { id: number; name: string };
}

export default function TipStaffClient({ hotel }: TipStaffClientProps) {
  const searchParams = useSearchParams();
  const dynamicMessage = searchParams.get("message");
  const hotelIdParam = searchParams.get("hotelId");
  const hotelId = hotelIdParam ? parseInt(hotelIdParam) : hotel.id;
  const [hotelName, setHotelName] = useState<string>(hotel.name);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchHotelData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/hotels/${hotelId}`);
        if (response.ok) {
          const data = await response.json();
          setHotelName(data.name || hotel.name);
        }
      } catch (error) {
        console.error("Failed to fetch hotel data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if the hotelId is different
    if (hotelId !== hotel.id) {
      fetchHotelData();
    }
  }, [hotelId, hotel.id, hotel.name]);

  const handleBack = () => window.history.back();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading tipping interface...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <TipStaffScreen
        onBack={handleBack}
        dynamicMessage={dynamicMessage || undefined}
        hotelName={hotelName}
        hotelId={hotelId}
      />
    </div>
  );
}
