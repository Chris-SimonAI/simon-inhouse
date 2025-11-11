"use client";

import Image from "next/image";
import Link from "next/link";
import { type PlaceResult } from "@/lib/places";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";

interface PlaceCardProps {
  result: PlaceResult;
  index: number;
  messageId: string;
  partIndex: number;
  type?: 'restaurant' | 'attraction';
  id?: string;
}

export function PlaceCard({
  result,
  index,
  messageId,
  partIndex,
  type,
  id,
}: PlaceCardProps) {
  const slug = useHotelSlug();
  const infoPath =
    slug && type && id
      ? hotelPath(
          slug,
          `/${type === "restaurant" ? "restaurants" : "attractions"}/${id}`,
        )
      : null;

  return (
    <div
      key={`${messageId}-${partIndex}-${index}`}
      className="bg-white border rounded-xl shadow-sm p-1 hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex gap-4 items-stretch">
        {result.photo && (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
            <Image
              src={result.photo}
              alt={result.name}
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
              <span className="mr-0.5">{result.name}</span>
            </h3>
            {result.rating && (
              <span className="flex items-center text-base text-gray-600 flex-shrink-0">
                <span className="font-medium">{result.rating.toFixed(1)}</span>
                <span className="ml-1 text-yellow-500">★</span>
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 capitalize">{result.category}</p>

{/* needs to be at bottom with top accounted for  dynamically */}
          <div className="flex items-end justify-between gap-3 mt-auto">
            <div className="flex gap-2">
              {infoPath ? (
                <Link
                  href={infoPath}
                  className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-1 flex-shrink-0"
                >
                  More Info
                </Link>
              ) : (
                <button
                  className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-1 flex-shrink-0"
                  disabled
                >
                  More Info
                </button>
              )}
            </div>
            {result.price && (
              <span className="text-gray-700 font-medium text-sm flex-shrink-0">
                {result.price}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
