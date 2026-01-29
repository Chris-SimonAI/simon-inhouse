'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ChevronLeft, ChevronRight, X, AlertTriangle, Utensils } from "lucide-react";
import { GuestDetailDialog } from "./guest-detail-dialog";

interface Guest {
  id: number;
  phone: string;
  email: string | null;
  name: string | null;
  roomNumber: string | null;
  dietaryPreferences: string[] | null;
  allergies: string[] | null;
  favoriteCuisines: string[] | null;
  dislikedFoods: string[] | null;
  notes: string | null;
  hotelId: number | null;
  hotelName: string | null;
  hasBeenIntroduced: boolean;
  lastOrderAt: Date | null;
  createdAt: Date;
}

interface Hotel {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface GuestTableProps {
  guests: Guest[];
  hotels: Hotel[];
  total: number;
  page: number;
  totalPages: number;
  currentFilters: {
    search?: string;
    hotelId?: string;
    hasAllergies?: string;
    hasDietary?: string;
  };
}

export function GuestTable({ guests, hotels, total, page, totalPages, currentFilters }: GuestTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentFilters.search || "");
  const [selectedGuestId, setSelectedGuestId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (currentFilters.search || "")) {
        updateFilters({ search: searchValue || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const updateFilters = (newFilters: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    if (!newFilters.page) {
      params.delete("page");
    }

    router.push(`/admin/guests?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchValue("");
    router.push("/admin/guests");
  };

  const hasActiveFilters = currentFilters.search || currentFilters.hotelId || currentFilters.hasAllergies || currentFilters.hasDietary;

  return (
    <>
      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 mb-6 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by phone, name, or email..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200 focus:border-slate-300 focus:ring-slate-200"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 rounded-xl border-slate-200 ${showFilters ? "bg-slate-50 border-slate-300" : ""}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} size="sm" className="text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4">
            <select
              value={currentFilters.hotelId || ""}
              onChange={(e) => updateFilters({ hotelId: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-slate-300"
            >
              <option value="">All Hotels</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={currentFilters.hasAllergies === "true"}
                onChange={(e) => updateFilters({ hasAllergies: e.target.checked ? "true" : undefined })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Has allergies
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={currentFilters.hasDietary === "true"}
                onChange={(e) => updateFilters({ hasDietary: e.target.checked ? "true" : undefined })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Has dietary preferences
            </label>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Guest</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hotel</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preferences</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guests.map((guest) => (
              <tr
                key={guest.id}
                className="hover:bg-slate-50/70 cursor-pointer transition-colors duration-150"
                onClick={() => setSelectedGuestId(guest.id)}
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">
                    {guest.name || "Unknown"}
                  </div>
                  {guest.roomNumber && (
                    <div className="text-xs text-slate-400 mt-0.5">Room {guest.roomNumber}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-700">{guest.phone}</div>
                  {guest.email && (
                    <div className="text-xs text-slate-400 mt-0.5">{guest.email}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {guest.hotelName || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {guest.allergies && guest.allergies.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        <AlertTriangle className="w-3 h-3" />
                        {guest.allergies.length} allerg{guest.allergies.length === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                    {guest.dietaryPreferences && guest.dietaryPreferences.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        <Utensils className="w-3 h-3" />
                        {guest.dietaryPreferences.length} dietary
                      </span>
                    )}
                    {(!guest.allergies || guest.allergies.length === 0) &&
                     (!guest.dietaryPreferences || guest.dietaryPreferences.length === 0) && (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {guest.lastOrderAt
                    ? new Date(guest.lastOrderAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : <span className="text-slate-300">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {guests.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            No guests match your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{(page - 1) * 20 + 1}</span> to <span className="font-medium text-slate-700">{Math.min(page * 20, total)}</span> of <span className="font-medium text-slate-700">{total}</span> guests
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateFilters({ page: String(page - 1) })}
              className="h-9 rounded-lg border-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
              className="h-9 rounded-lg border-slate-200 disabled:opacity-40"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <GuestDetailDialog
        guestId={selectedGuestId}
        onClose={() => setSelectedGuestId(null)}
      />
    </>
  );
}
