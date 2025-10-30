"use client";

import type { PlaceResult } from "@/lib/places";
import { PlaceCard } from "./place-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { MapPin, MapPinOff } from "lucide-react";
import { useEffect, useRef } from "react";

interface AttractionsViewProps {
  attractions: PlaceResult[];
  messageId: string;
  partIndex: number;
}

export function AttractionsView({
  attractions,
  messageId,
  partIndex,
}: AttractionsViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || attractions.length === 0 || googleMapRef.current)
      return;

    // Load Google Maps script
    const loadGoogleMaps = () => {
      if (window.google?.maps) {
        initializeMap();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector(
        `script[src*="maps.googleapis.com"]`
      );
      if (existingScript) {
        existingScript.addEventListener("load", initializeMap);
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || googleMapRef.current) return;

      // Filter attractions with valid coordinates
      const validAttractions = attractions.filter(
        (a) => a.latitude !== undefined && a.longitude !== undefined
      );

      if (validAttractions.length === 0) return;

      // Create map centered on first attraction with all controls disabled
      const map = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: {
          lat: validAttractions[0].latitude!,
          lng: validAttractions[0].longitude!,
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        scaleControl: false,
        rotateControl: false,
        panControl: false,
        gestureHandling: "cooperative",
        disableDefaultUI: true,
      });

      googleMapRef.current = map;

      // Add markers for each attraction
      const bounds = new google.maps.LatLngBounds();
      validAttractions.forEach((attraction, idx) => {
        const marker = new google.maps.Marker({
          position: {
            lat: attraction.latitude!,
            lng: attraction.longitude!,
          },
          map,
          label: {
            text: `${idx + 1}`,
            color: "white",
            fontWeight: "bold",
          },
          title: attraction.name,
        });

        // Extend bounds to include this marker
        bounds.extend(marker.getPosition()!);

      });

      // Fit map to show all markers
      map.fitBounds(bounds);

      // Add some padding to bounds
      const padding = { top: 50, right: 50, bottom: 50, left: 50 };
      map.fitBounds(bounds, padding);
    };

    loadGoogleMaps();
  }, [attractions, apiKey]);

  // Empty state when no attractions are found
  if (attractions.length === 0) {
    return (
      <div className="w-full space-y-6">
        <div className="relative">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Attractions Map
          </h3>

          <div className="relative w-full h-96 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-50" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-full shadow-lg mb-3">
                <MapPinOff
                  className="w-12 h-12 text-gray-400"
                  strokeWidth={1.5}
                />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                No Attractions Found
              </h4>
              <p className="text-sm text-gray-500 max-w-md px-5 text-center">
                No attractions matching your request found in this area. Try
                searching for other places
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="relative">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Attractions Map ({attractions.length} locations)
        </h3>

        <div ref={mapRef} className="w-full h-96 rounded-lg shadow" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Explore Attractions
        </h3>

        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {attractions.map((attraction, index) => (
              <CarouselItem
                key={`${messageId}-${partIndex}-${index}`}
                className="basis-[80%]"
              >
                <div className="relative">
                  <div className="absolute top-2 left-2 z-10 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <PlaceCard
                    result={attraction}
                    index={index}
                    messageId={messageId}
                    partIndex={partIndex}
                    type="attraction"
                    id={attraction.id}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    </div>
  );
}
