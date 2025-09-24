"use client";

import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Star, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "@/components/ui/markdown";
import Link from "next/link";
import { DineInRestaurant } from "@/db/schemas";

export function DineInRestaurantPage({
  restaurantGuid,
  name,
  addressLine1,
  cuisine,
  rating,
  imageUrls,  
  description,
}: DineInRestaurant) {
  const router = useRouter();

  const handleBackToChat = () => {
    router.push("/?l1=open", { scroll: false });
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {name}
          </h1>
          <Button
            onClick={handleBackToChat}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
            variant="ghost"
            size="sm"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Photo Carousel */}
        {imageUrls?.length && imageUrls?.length > 0 && ( 
          <Carousel className="w-full px-4 pt-4">
            <CarouselContent>
              {imageUrls?.map((imageUrl: string, index: number) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                    <Image
                      src={imageUrl}
                      alt={`${name} - Photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={index === 0}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {imageUrls?.length && imageUrls?.length > 1 && (     
              <>
                <CarouselPrevious className="left-4" />
                <CarouselNext className="right-4" />
              </>
            )}
          </Carousel>
        )}

        {/* Restaurant Details */}
        <div className="p-4">
          {/* Rating and Cuisine */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 text-sm">{addressLine1}</span>
              </div>
              <span className="text-gray-500 text-sm">• {cuisine}</span>
            </div>

            {/* Location */}
            {rating ? (
            <div className="flex items-center">
              <Star className="w-4 h-4 text-gray-500" />
              <span className="ml-1 text-sm font-medium text-gray-700">
                {parseFloat(rating).toFixed(1)}  
              </span>
            </div>
            ) : null}
          </div>


          {/* Description */}
          {description && (
            <div className="mb-6">
              <div className="text-gray-700 leading-relaxed text-sm">
                <ReactMarkdown components={markdownComponents}>
                  {description}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-30 bg-white">
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link href={`/dine-in/restaurant/${restaurantGuid}/menu`} className="w-full">
            <Button className="w-full text-lg bg-black text-white py-6 font-medium hover:bg-black/80">
              Order From Menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}