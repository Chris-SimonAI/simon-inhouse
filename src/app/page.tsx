import { getHotelSession } from "@/actions/sessions";
import { getHotelById } from "@/actions/hotels";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const sessionResult = await getHotelSession();
  if (!sessionResult.ok || !sessionResult.data.hotelId) {
    redirect("/hotel-not-found");
  }

  const hotelId = sessionResult.data.hotelId;
  const hotelResult = await getHotelById(hotelId);
  if (!hotelResult.ok || !hotelResult.data?.slug) {
    redirect("/hotel-not-found");
  }

  redirect(`/${hotelResult.data.slug}`);
}
