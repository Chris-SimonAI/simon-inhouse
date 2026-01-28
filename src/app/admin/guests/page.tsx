import { getGuestProfiles } from "@/actions/guest-profiles";
import { getAllHotels } from "@/actions/hotels";
import { GuestTable } from "./guest-table";
import { Users } from "lucide-react";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    hotelId?: string;
    hasAllergies?: string;
    hasDietary?: string;
    page?: string;
  }>;
}

export default async function GuestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const hotelId = params.hotelId ? parseInt(params.hotelId, 10) : undefined;

  const [guestsResult, hotelsResult] = await Promise.all([
    getGuestProfiles({
      search: params.search,
      hotelId,
      hasAllergies: params.hasAllergies === "true",
      hasDietary: params.hasDietary === "true",
      page,
      limit: 20,
    }),
    getAllHotels(),
  ]);

  const hotels = (hotelsResult.ok && hotelsResult.data) ? hotelsResult.data : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Guests</h1>
        <p className="text-slate-500 mt-1">
          {guestsResult.total} guest profiles
        </p>
      </div>

      {guestsResult.guests.length > 0 || params.search || params.hotelId ? (
        <GuestTable
          guests={guestsResult.guests}
          hotels={hotels}
          total={guestsResult.total}
          page={guestsResult.page}
          totalPages={guestsResult.totalPages}
          currentFilters={{
            search: params.search,
            hotelId: params.hotelId,
            hasAllergies: params.hasAllergies,
            hasDietary: params.hasDietary,
          }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-900">No guests yet</p>
          <p className="text-slate-500 mt-1">
            Guest profiles will appear here once they place orders or interact via SMS.
          </p>
        </div>
      )}
    </div>
  );
}
