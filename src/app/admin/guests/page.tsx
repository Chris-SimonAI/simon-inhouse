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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Guests</h1>
        <p className="text-slate-500 mt-0.5 text-sm">
          {guestsResult.total} guest profile{guestsResult.total !== 1 ? 's' : ''} in system
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
        <div className="bg-white rounded-2xl border border-slate-200/60 p-16 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-900">No guests yet</p>
          <p className="text-slate-500 mt-1 text-sm max-w-sm mx-auto">
            Guest profiles will appear here once they place orders or interact via SMS.
          </p>
        </div>
      )}
    </div>
  );
}
