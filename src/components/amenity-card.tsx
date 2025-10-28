"use client";

import Image from "next/image";
import { type Amenity } from "@/db/schemas/amenities";
import Link from "next/link";

interface AmenityCardProps {
    amenity: Amenity;
    index: number;
    messageId: string;
    partIndex: number;
}

export function AmenityCard({
    amenity,
    index,
    messageId,
    partIndex,
}: AmenityCardProps) {
    const primaryImage = amenity.imageUrls?.[0];

    return (
        <div
            key={`${messageId}-${partIndex}-${index}`}
            className="bg-white border rounded-xl shadow-sm p-1 hover:shadow-md transition-shadow duration-200"
        >
            <div className="flex gap-4 items-stretch">
                {primaryImage && (
                    <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
                        <Image
                            src={primaryImage}
                            alt={amenity.name}
                            width={100}
                            height={100}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col self-stretch">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-800 text-lg leading-tight flex-1 min-w-0 truncate">
                            <span className="mr-0.5">{amenity.name}</span>
                        </h3>
                    </div>

                    {amenity.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {amenity.description}
                        </p>
                    )}

                    <div className="flex items-end justify-between gap-3 mt-auto">
                        <div className="flex gap-2">
                            <Link
                                href={`/amenities/${amenity.id}`}
                                className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-1 flex-shrink-0"
                            >
                                More Info
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
