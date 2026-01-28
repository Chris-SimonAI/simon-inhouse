'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
      <div className="bg-white rounded-xl shadow-sm border mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by phone, name, or email..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-slate-100" : ""}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} size="sm">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
            <select
              value={currentFilters.hotelId || ""}
              onChange={(e) => updateFilters({ hotelId: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Hotels</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={currentFilters.hasAllergies === "true"}
                onChange={(e) => updateFilters({ hasAllergies: e.target.checked ? "true" : undefined })}
                className="rounded"
              />
              Has allergies
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={currentFilters.hasDietary === "true"}
                onChange={(e) => updateFilters({ hasDietary: e.target.checked ? "true" : undefined })}
                className="rounded"
              />
              Has dietary preferences
            </label>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Guest</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Contact</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Hotel</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Preferences</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Last Order</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {guests.map((guest) => (
              <tr
                key={guest.id}
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedGuestId(guest.id)}
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">
                    {guest.name || "Unknown"}
                  </div>
                  {guest.roomNumber && (
                    <div className="text-xs text-slate-400">Room {guest.roomNumber}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-900">{guest.phone}</div>
                  {guest.email && (
                    <div className="text-xs text-slate-500">{guest.email}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {guest.hotelName || "—"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {guest.allergies && guest.allergies.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {guest.allergies.length} allerg{guest.allergies.length === 1 ? 'y' : 'ies'}
                      </Badge>
                    )}
                    {guest.dietaryPreferences && guest.dietaryPreferences.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Utensils className="w-3 h-3 mr-1" />
                        {guest.dietaryPreferences.length} dietary
                      </Badge>
                    )}
                    {(!guest.allergies || guest.allergies.length === 0) &&
                     (!guest.dietaryPreferences || guest.dietaryPreferences.length === 0) && (
                      <span className="text-xs text-slate-400">None</span>
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
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {guests.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No guests match your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} guests
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateFilters({ page: String(page - 1) })}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="w-4 h-4" />
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
