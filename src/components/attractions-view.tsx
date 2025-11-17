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
import { useEffect, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { MapPinMarker } from "@/svgs";

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
  const validAttractions = useMemo(
    () =>
      attractions.filter(
        (a) => a.latitude !== undefined && a.longitude !== undefined
      ),
    [attractions]
  );

  const defaultCenter = useMemo(() => {
    if (validAttractions.length === 0) return undefined;
    return {
      lat: validAttractions[0].latitude as number,
      lng: validAttractions[0].longitude as number,
    };
  }, [validAttractions]);

  function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
      if (!map || points.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 50);
    }, [map, points]);
    return null;
  }

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
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <div className="w-full h-96 rounded-lg shadow overflow-hidden">
              <Map
                mapId="attractions-map"
                defaultCenter={defaultCenter}
                defaultZoom={12}
                gestureHandling="cooperative"
                disableDefaultUI={true}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                zoomControl={false}
              >
                {validAttractions.map((attraction, idx) => (
                  <AdvancedMarker
                    key={`${attraction.id}-${idx}`}
                    position={{
                      lat: attraction.latitude as number,
                      lng: attraction.longitude as number,
                    }}
                    title={attraction.name}
                  >
                    <MapPinMarker number={idx + 1} />
                  </AdvancedMarker>
                ))}
                <FitBounds
                  points={validAttractions.map((a) => ({
                    lat: a.latitude as number,
                    lng: a.longitude as number,
                  }))}
                />
              </Map>
            </div>
          </APIProvider>
        ) : (
          <div className="w-full h-96 rounded-lg shadow flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-500">
              Google Maps API key is not configured
            </p>
          </div>
        )}
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
