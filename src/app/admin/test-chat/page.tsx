import { getAllHotels } from "@/actions/hotels";
import { getGuestProfiles } from "@/actions/guest-profiles";
import { TestChatClient } from "./test-chat-client";

export const dynamic = 'force-dynamic';

export default async function TestChatPage() {
  const [hotelsResult, guestsResult] = await Promise.all([
    getAllHotels(),
    getGuestProfiles({ limit: 100 }),
  ]);

  const hotels = hotelsResult.ok && hotelsResult.data ? hotelsResult.data : [];
  const guests = guestsResult.guests || [];

  return <TestChatClient hotels={hotels} initialGuests={guests} />;
}
