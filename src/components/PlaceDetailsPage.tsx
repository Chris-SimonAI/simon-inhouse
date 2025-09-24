"use client";

import Image from "next/image";
import { PlaceDetails } from "@/lib/places";
import { formatPriceLevel } from "@/lib/place-utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Phone, Globe, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface PlaceDetailsPageProps {
  placeDetails: PlaceDetails;
  type: 'restaurant' | 'attraction';
}

export function PlaceDetailsPage({ placeDetails, type }: PlaceDetailsPageProps) {
  const router = useRouter();

  const handleDirections = () => {
    if (placeDetails.location) {
      const { latitude, longitude } = placeDetails.location;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      window.open(url, '_blank');
    }
  };

  const handleBackToChat = () => {
    router.push('/?l1=open', { scroll: false });
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {placeDetails.name}
          </h1>
          <Button
            onClick={handleBackToChat}
            className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="bg-white flex-1 flex flex-col">
        {/* Photo Carousel */}
        {placeDetails.photos.length > 0 && (
          <Carousel className="w-full px-4">
            <CarouselContent>
              {placeDetails.photos.map((photo, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={photo}
                      alt={`${placeDetails.name} - Photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {placeDetails.photos.length > 1 && (
              <>
                <CarouselPrevious className="left-4" />
                <CarouselNext className="right-4" />
              </>
            )}
          </Carousel>
        )}

        {/* Place Details */}
        <div className="p-4 [&>div:last-child]:mb-0">
          {/* Rating */}
          {placeDetails.rating && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-gray-500" />
                <span className="ml-1 text-sm font-medium text-gray-700">
                  {placeDetails.rating.toFixed(1)}
                </span>
              </div>
              {placeDetails.priceLevel && (
                <span className="text-gray-500 text-sm">
                  • {formatPriceLevel(placeDetails.priceLevel)}
                </span>
              )}
            </div>
          )}

          {/* Address */}
          {placeDetails.address && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 text-sm">{placeDetails.address}</span>
            </div>
          )}

          {/* Phone */}
          {placeDetails.internationalPhoneNumber && (
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <a
                href={`tel:${placeDetails.internationalPhoneNumber}`}
                className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
              >
                {placeDetails.internationalPhoneNumber}
              </a>
            </div>
          )}

          {/* Website */}
          {placeDetails.websiteUri && (
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <a
                href={placeDetails.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
              >
                Visit Website
              </a>
            </div>
          )}

          {/* Description */}
          {placeDetails.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-black-400">
                About this {type === 'restaurant' ? 'restaurant' : 'attraction'}
              </h2>
              <div className="text-black-400 leading-relaxed whitespace-pre-line text-sm">
                {placeDetails.description}
              </div>
            </div>
          )}

          {/* Review Summary */}
          {placeDetails.reviewSummary && placeDetails.reviewSummary.trim() !== "undefined" && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-black-400">
                What people are saying
              </h2>
              <div className="text-black-400 leading-relaxed whitespace-pre-line text-sm">
                {placeDetails.reviewSummary}
              </div>
            </div>
          )}

          {/* Neighborhood Summary */}
          {placeDetails.neighborhoodSummary && placeDetails.neighborhoodSummary.trim() !== "undefined" && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                About the neighborhood
              </h2>
              <div className="text-gray-700 leading-relaxed text-sm whitespace-pre-line">
                {placeDetails.neighborhoodSummary}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Directions Button */}
      <div className="p-4 sticky bottom-0 z-30 bg-white">
        <Button
          onClick={handleDirections}
          className="w-full text-white bg-black hover:bg-black py-6 text-lg font-medium"
          disabled={!placeDetails.location}
        >
          Get Directions
        </Button>
      </div>
    </div>
  );
}
