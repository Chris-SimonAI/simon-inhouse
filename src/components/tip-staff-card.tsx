'use client';

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { hotelPath } from "@/utils/hotel-path";
import { useHotelSlug } from "@/hooks/use-hotel-slug";

type TipStaffCardProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  imageSrc?: string;
  imageAlt?: string;
  className?: string;
};

export const TIP_STAFF_CARD_DEFAULT_TITLE = "Tip Our Staff";
export const TIP_STAFF_CARD_DEFAULT_DESCRIPTION = "Show appreciation to our amazing team";
export const TIP_STAFF_CARD_DEFAULT_CTA_LABEL = "Tip Staff";
export const TIP_STAFF_CARD_DEFAULT_IMAGE_SRC = "/staff-team.jpg";
export const TIP_STAFF_CARD_DEFAULT_IMAGE_ALT = "Staff Team";

export function TipStaffCard({
  title = TIP_STAFF_CARD_DEFAULT_TITLE,
  description = TIP_STAFF_CARD_DEFAULT_DESCRIPTION,
  ctaLabel = TIP_STAFF_CARD_DEFAULT_CTA_LABEL,
  imageSrc = TIP_STAFF_CARD_DEFAULT_IMAGE_SRC,
  imageAlt = TIP_STAFF_CARD_DEFAULT_IMAGE_ALT,
  className,
}: TipStaffCardProps) {
  const slug = useHotelSlug();
  return (
    <div className={cn("bg-white border rounded-xl shadow-sm p-1 hover:shadow-md transition-shadow duration-200", className)}>
      <div className="flex gap-4 items-stretch">
        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={100}
            height={100}
            className="w-full h-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col self-stretch">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 text-lg leading-tight flex-1 min-w-0 truncate text-left">
              <span className="mr-0.5">{title}</span>
            </h3>
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2 text-left">
            {description}
          </p>

          <div className="flex items-end justify-between gap-3 mt-auto">
            <div className="flex gap-2">
              <Link
                href={hotelPath(slug, '/tip-staff')}
                className="bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-1 flex-shrink-0"
              >
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

