"use client";

import { TipStaffScreen } from "@/components/tip-staff-screen";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { DEFAULT_HOTEL_ID } from "@/constants";

function TipStaffContent() {
  const searchParams = useSearchParams();
  const dynamicMessage = searchParams.get('message');
  const hotelIdParam = searchParams.get('hotelId');
  const hotelId = hotelIdParam ? parseInt(hotelIdParam) : DEFAULT_HOTEL_ID;
  const [hotelName, setHotelName] = useState<string>("Hotel");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchHotelData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/hotels/${hotelId}`);
        if (response.ok) {
          const data = await response.json();
          setHotelName(data.name || "Hotel");
        }
      } catch (error) {
        console.error("Failed to fetch hotel data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch hotel data in background without blocking UI
    fetchHotelData();
  }, [hotelId]);

  const handleBack = () => {
    window.history.back();
  };

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

export default function TipStaffPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading tipping interface...</span>
      </div>
    }>
      <TipStaffContent />
    </Suspense>
  );
}
