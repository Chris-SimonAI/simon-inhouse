"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { DineInRestaurant } from "@/db/schemas";
import { useHotelSlug } from "@/hooks/use-hotel-slug";
import { hotelPath } from "@/utils/hotel-path";
import { Analytics } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { formatRestaurantHoursLine } from "@/lib/business-hours";

export function DineInRestaurantCard({
  restaurantGuid,
  name,
  imageUrls,
  businessHours,
}: DineInRestaurant) {
  const slug = useHotelSlug();
  const href = slug
    ? hotelPath(slug, `/dine-in/restaurant/${restaurantGuid}/menu`)
    : "#";

  useEffect(() => {
    Analytics.capture(AnalyticsEvents.dineInRestaurantCardViewed, {
      restaurant_guid: restaurantGuid,
      restaurant_name: name,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOrderClick = () => {
    Analytics.capture(AnalyticsEvents.dineInRestaurantOrderClicked, {
      restaurant_guid: restaurantGuid,
      restaurant_name: name,
    });
  };

  const hoursLine = formatRestaurantHoursLine(businessHours);

  return (
    <div
      key={restaurantGuid}
      className="bg-white border rounded-xl shadow-sm p-1 hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex gap-4 items-stretch">
        {imageUrls ? (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
            <Image
              src={imageUrls[0]}
              alt={name}
              width={100}
              height={100}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken images gracefully
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : null}

        <div className="flex-1 min-w-0 flex flex-col self-stretch">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 text-lg leading-tight flex-1 min-w-0 truncate">
              <span className="mr-0.5">{name}</span>
            </h3>

            {/* {rating ? (
              <span className="flex items-center text-base text-gray-600 flex-shrink-0">
                <span className="font-medium">{parseFloat(rating).toFixed(1)}</span>
                <span className="ml-1 text-yellow-500">★</span>
              </span>
            ) : null} */}
          </div>

          {hoursLine ? (
            <p className="text-xs font-semibold text-gray-900 mt-1 truncate">
              {hoursLine}
            </p>
          ) : null}

          {/* Subtext line: cuisine (if provided) TODO: clarify if we can get this from scraping as it is not available in the Toast API */}
          {/* <p className="text-sm text-gray-600 truncate">
            {cuisine ? <span className="capitalize">{cuisine}</span> : null}
          </p> */}

          {/* Bottom row pinned */}
          <div className="flex items-end justify-between gap-3 mt-auto">
            <div className="flex gap-2">
              <Link
                href={href}
                className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-1 flex-shrink-0"
                aria-disabled={!slug}
                onClick={handleOrderClick}
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}