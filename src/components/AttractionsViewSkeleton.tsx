"use client";

import { MapPin } from "lucide-react";
import { CardSkeleton } from "./CardSkeleton";

export function AttractionsViewSkeleton() {
    return (
        <div className="w-full space-y-6">
            {/* Map skeleton */}
            <div className="relative">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
                </h3>

                <div className="relative w-full h-96 bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-gray-400" />
                </div>
            </div>

            {/* Carousel skeleton */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Explore Attractions
                </h3>

                <div className="flex gap-4 overflow-x-auto pb-2">
                    {Array(3)
                        .fill(null)
                        .map((_, idx) => (
                            <div key={idx} className="flex-shrink-0 w-[80%]">
                                <CardSkeleton />
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
