import { getHotelSession } from "@/actions/sessions";
import { getHotelById } from "@/actions/hotels";
import { redirect } from "next/navigation";

/**
 * Ensures a valid BetterAuth hotel session exists.
 * Returns the base session info and hotel data.
 */
export async function requireHotelSession() {
  const sessionResult = await getHotelSession();
  if (!sessionResult.ok || !sessionResult.data) redirect("/hotel-not-found");

  const { qrData } = sessionResult.data;
  const hotelId = parseInt(qrData.hotelId);
  const threadId = qrData.threadId;

  const hotelResult = await getHotelById(hotelId);
  if (!hotelResult.ok || !hotelResult.data) redirect("/hotel-not-found");

  return {
    hotel: hotelResult.data,
    threadId,
  };
}
