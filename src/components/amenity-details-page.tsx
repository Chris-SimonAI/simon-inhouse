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
import { Button } from "./ui/button";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "@/components/ui/markdown";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";


interface AmenityDetailsPageProps {
    amenity: Amenity;
}

export function AmenityDetailsPage({ amenity }: AmenityDetailsPageProps) {
    const router = useRouter();
    const slug = useHotelSlug();

    const handleBackToChat = () => {
        router.push(`${hotelPath(slug)}?l1=open`, { scroll: false });
    };

    return (
        <div className="flex flex-col">
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
                                    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                                        <Image
                                            src={photo}
                                            alt={`${amenity.name} - Photo ${index + 1}`}
                                            fill
                                            className="object-contain"
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
                    {amenity.longDescription && (
                        <div className="prose max-w-none space-y-6">
                            <ReactMarkdown components={markdownComponents}>{amenity.longDescription}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
