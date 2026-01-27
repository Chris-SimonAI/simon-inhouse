"use client";

import Image from "next/image";
import type { Hotel } from "@/db/schemas/hotels";
import type { DineInRestaurant } from "@/db/schemas";
import { DineInRestaurantCard } from "@/components/dine-in-restaurant-card";
import { TipStaffCard } from "@/components/tip-staff-card";
import { SimonLogo } from "@/svgs";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Utensils } from "lucide-react";

type RestaurantListViewProps = {
  hotel: Hotel;
  restaurants: DineInRestaurant[];
};

export function RestaurantListView({ hotel, restaurants }: RestaurantListViewProps) {
  return (
    <div className="flex flex-col h-dvh w-full overflow-x-hidden bg-white">
      <div className="flex-1 overflow-y-auto px-4 text-center mb-2 mt-2">
        <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

        <div className="text-center mb-4">
          <div className="relative bg-gray-900 rounded-full flex items-center justify-center mx-auto w-16 h-16">
            <SimonLogo className="w-16 h-16" aria-label="Simon" />
          </div>
        </div>

        <p className="text-gray-600 text-base leading-relaxed mb-8">
          Hello. I am Simon, your personal AI concierge at {hotel.name}.
          Order from our partner restaurants and have your meal delivered to your room.
        </p>

        {/* Restaurant List */}
        <div className="px-2 mb-4">
          <h2 className="text-base leading-relaxed text-black mb-2 text-left font-semibold">
            Delivered to your room
          </h2>
        </div>

        {restaurants.length > 0 ? (
          <div className="px-2 space-y-3 mb-6">
            {restaurants.map((restaurant) => (
              <DineInRestaurantCard key={restaurant.id} {...restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 mb-6">
            <Utensils className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No restaurants available</p>
            <p className="text-sm mt-1">Check back soon for dine-in options.</p>
          </div>
        )}

        {/* Promotional Carousel */}
        <div className="px-2 mb-6">
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {/* Dining Discount Card */}
              <CarouselItem className="basis-[80%]">
                <div className="bg-white border rounded-xl shadow-sm p-1 hover:shadow-md transition-shadow duration-200">
                  <div className="flex gap-4 items-stretch">
                    <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
                      <Image
                        src="/dining-discount.png"
                        alt="Dining Discount"
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col self-stretch">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-800 text-lg leading-tight min-w-0 truncate">
                          <span className="mr-0.5">Hungry?</span>
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2 text-left">
                        Get 20% off your first in-room dining order
                      </p>
                    </div>
                  </div>
                </div>
              </CarouselItem>

              {/* Tip Staff Card */}
              <CarouselItem className="basis-[80%]">
                <TipStaffCard />
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-4 mt-auto">
        <div className="text-center">
          <a
            href="mailto:support@meetsimon.ai"
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            Questions? support@meetsimon.ai
          </a>
        </div>
      </div>
    </div>
  );
}
