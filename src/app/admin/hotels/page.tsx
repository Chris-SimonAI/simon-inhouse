import { getAllHotels } from "@/actions/hotels";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DeleteHotelButton } from "./delete-hotel-button";

export default async function HotelsPage() {
  const result = await getAllHotels();
  const hotels = result.ok ? result.data! : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hotels</h1>
          <p className="text-slate-500 mt-1">{hotels.length} locations</p>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/hotels/new">
            <Plus className="w-5 h-5 mr-2" />
            Add Hotel
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Name</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Slug</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Address</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Discount</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Stripe</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {hotels.map((hotel) => (
              <tr key={hotel.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{hotel.name}</div>
                </td>
                <td className="px-6 py-4">
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">/{hotel.slug}</code>
                </td>
                <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                  {hotel.address || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {hotel.restaurantDiscount}%
                </td>
                <td className="px-6 py-4">
                  {hotel.stripeAccountId ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Not connected
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/hotels/${hotel.id}/restaurants`}>Restaurants</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/hotels/${hotel.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteHotelButton hotelId={hotel.id} hotelName={hotel.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hotels.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg font-medium">No hotels yet</p>
            <p className="mt-1">Click &quot;Add Hotel&quot; to create your first location.</p>
          </div>
        )}
      </div>
    </div>
  );
}
