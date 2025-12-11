"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { Analytics } from "@/lib/analytics/client";
import { authClient } from "@/lib/auth-client";
import { useHotelSlug } from "@/hooks/use-hotel-slug";

export function AnalyticsAuthProvider({ children }: { children: ReactNode }) {
  const hotelName = useHotelSlug();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || !hotelName) return;

    if (session?.user) {
      Analytics.identify(session.user.id, {
        hotel_name: hotelName,
      });
    } else {
      Analytics.reset();
    }
  }, [session, isPending, hotelName]);

  return <>{children}</>;
}


