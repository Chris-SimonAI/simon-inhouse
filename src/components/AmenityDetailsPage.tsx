"use client";

import Image from "next/image";
import { type Amenity } from "@/db/schemas/amenities";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Response } from "./ai-elements/response";
import { Button } from "./ui/button";

interface AmenityDetailsPageProps {
    amenity: Amenity;
}

export function AmenityDetailsPage({ amenity }: AmenityDetailsPageProps) {
    const router = useRouter();

    const handleBackToChat = () => {
        router.push('/?l1=open');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
                        {amenity.name}
                    </h1>
                    <Button
                        onClick={handleBackToChat}
                        className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
                    >                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="bg-white flex-1 flex flex-col">
                {/* Photo Carousel */}
                {amenity.imageUrls && amenity.imageUrls.length > 0 && (
                    <Carousel className="w-full px-4">
                        <CarouselContent>
                            {amenity.imageUrls.map((photo, index) => (
                                <CarouselItem key={index}>
                                    <div className="relative aspect-video w-full overflow-hidden">
                                        <Image
                                            src={photo}
                                            alt={`${amenity.name} - Photo ${index + 1}`}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        {amenity.imageUrls.length > 1 && (
                            <>
                                <CarouselPrevious className="left-4" />
                                <CarouselNext className="right-4" />
                            </>
                        )}
                    </Carousel>
                )}

                {/* Amenity Details */}
                <div className="p-4 [&>div:last-child]:mb-0">
                    {/* Long Description */}
                    {amenity.longDescription && (
                        <div className="mb-6">
                            <Response>{amenity.longDescription}</Response>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
