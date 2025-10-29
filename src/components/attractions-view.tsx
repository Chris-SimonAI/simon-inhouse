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
import Image from "next/image";

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
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
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
                I couldn't find any attractions matching your request in this
                area. Try asking about different types of places or a broader
                location nearby.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const markers = attractions
    .map((a, idx) => `markers=label:${idx + 1}|${a.latitude},${a.longitude}`)
    .join("&");

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=800x400&${markers}&key=${apiKey}`;

  return (
    <div className="w-full space-y-6">
      <div className="relative">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Attractions Map ({attractions.length} locations)
        </h3>

        <div className="relative w-full h-96">
          <Image
            src={mapUrl}
            alt="Map with attractions"
            fill
            className="rounded-lg shadow object-cover"
            unoptimized
          />
        </div>
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
