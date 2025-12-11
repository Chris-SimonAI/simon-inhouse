import { ensureSessionForHotel, getHotelSession } from "@/actions/sessions";
import { getHotelBySlug } from "@/actions/hotels";
import { redirect } from "next/navigation";

/**
 * Ensures a valid BetterAuth hotel session exists.
 * Returns the base session info and hotel data.
 */
interface RequireHotelSessionOptions {
  hotelSlug: string;
  redirectTo?: string;
}

export async function requireHotelSession({
  hotelSlug,
  redirectTo,
}: RequireHotelSessionOptions) {
  const hotelResult = await getHotelBySlug(hotelSlug);
  if (!hotelResult.ok || !hotelResult.data) {
    redirect("/hotel-not-found");
  }

  const redirectTarget =
    redirectTo?.startsWith("/")
      ? redirectTo
      : `/${hotelSlug}`;

  const sessionResult = await getHotelSession();
  if (!sessionResult.ok || !sessionResult.data) {
    redirect(
      `/auth/anonymous?slug=${hotelSlug}&redirect=${encodeURIComponent(redirectTarget)}`,
    );
  }

  let { hotelId, threadId, userId } = sessionResult.data;

  if (hotelId !== hotelResult.data.id || !threadId) {
    const ensuredSession = await ensureSessionForHotel(hotelResult.data.id);
    if (!ensuredSession.ok || !ensuredSession.data) {
      redirect(
        `/auth/anonymous?slug=${hotelSlug}&redirect=${encodeURIComponent(redirectTarget)}`,
      );
    }
    hotelId = ensuredSession.data.hotelId;
    threadId = ensuredSession.data.threadId;
    userId = ensuredSession.data.userId;
  }

  if (hotelId !== hotelResult.data.id || !threadId) {
    redirect(
      `/auth/anonymous?slug=${hotelSlug}&redirect=${encodeURIComponent(redirectTarget)}`,
    );
  }

  return {
    hotel: hotelResult.data,
    threadId,
    userId,
  };
}
