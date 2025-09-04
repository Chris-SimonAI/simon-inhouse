"use client";

import type { PlaceResult } from "@/lib/places";
import { PlaceCard } from "./PlaceCard";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { MapPin } from "lucide-react";
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