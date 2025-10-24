"use client";

export function CardSkeleton() {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-1.5 animate-pulse">
            <div className="flex gap-4 items-stretch">
                {/* Image skeleton */}
                <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-gray-200" />

                <div className="flex-1 min-w-0 flex flex-col self-stretch">
                    {/* Title and rating skeleton */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="h-6 bg-gray-200 rounded w-3/4" />
                        <div className="h-6 bg-gray-200 rounded w-12 flex-shrink-0" />
                    </div>

                    {/* Subtitle skeleton */}
                    <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />

                    {/* Button skeleton */}
                    <div className="flex items-end justify-between gap-3 mt-auto">
                        <div className="h-8 bg-gray-200 rounded w-24" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CardSkeletonGroup({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}
