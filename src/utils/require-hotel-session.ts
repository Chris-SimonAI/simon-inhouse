import { getHotelSession } from "@/actions/sessions";
import { getHotelById } from "@/actions/hotels";
import { redirect } from "next/navigation";

/**
 * Ensures a valid BetterAuth hotel session exists.
 * Returns the base session info and hotel data.
 * 
 * Does NOT fetch voice agent context — pages can do that individually.
 */
export async function requireHotelSession() {
  // 1️⃣ Validate session via Better Auth
  const sessionResult = await getHotelSession();
  if (!sessionResult.ok || !sessionResult.data) redirect("/hotel-not-found");

  const { qrData } = sessionResult.data;
  const hotelId = parseInt(qrData.hotelId);
  const threadId = qrData.threadId;

  // 2️⃣ Fetch hotel details
  const hotelResult = await getHotelById(hotelId);
  if (!hotelResult.ok || !hotelResult.data) redirect("/hotel-not-found");

  // 3️⃣ Return only essential info
  return {
    hotel: hotelResult.data,
    hotelId,
    threadId,
  };
}
