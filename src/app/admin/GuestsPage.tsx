import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE } from '../config';
import { GuestDetailDialog } from './guests/GuestDetailDialog';

interface Guest {
  id: number;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  dietary_preferences: string | null;
  allergies: string | null;
  favorite_cuisines: string | null;
  dislikes: string | null;
  notes: string | null;
  order_count: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: number;
  name: string;
}

interface GuestsResponse {
  guests: Guest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHotel, setSelectedHotel] = useState<string>('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasDietary, setHasDietary] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail dialog
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLocations = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/locations`);
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedHotel) params.set('hotelId', selectedHotel);
      if (hasAllergies) params.set('hasAllergies', 'true');
      if (hasDietary) params.set('hasDietary', 'true');
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`${API_BASE}/api/admin/guests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch guests');

      const data: GuestsResponse = await response.json();
      setGuests(data.guests);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guests');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedHotel, hasAllergies, hasDietary, page]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  const handleGuestClick = (guest: Guest) => {
    setSelectedGuest(guest);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedGuest(null);
  };

  const handleGuestUpdated = () => {
    fetchGuests();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedHotel('');
    setHasAllergies(false);
    setHasDietary(false);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedHotel || hasAllergies || hasDietary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Guest Profiles</h2>
          <button
            onClick={fetchGuests}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-sm text-gray-500">
          {total} guest{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by phone, name, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Hotel Filter */}
          <select
            value={selectedHotel}
            onChange={e => { setSelectedHotel(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Hotels</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* Toggle Filters */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasAllergies}
              onChange={e => { setHasAllergies(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Has Allergies</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDietary}
              onChange={e => { setHasDietary(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Has Dietary Preferences</span>
          </label>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Guest Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Guest
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preferences
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Order
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && guests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Loading guests...
                </td>
              </tr>
            ) : guests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {hasActiveFilters ? 'No guests match your filters' : 'No guests found'}
                </td>
              </tr>
            ) : (
              guests.map(guest => (
                <tr
                  key={guest.id}
                  onClick={() => handleGuestClick(guest)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {guest.first_name || guest.last_name
                            ? `${guest.first_name || ''} ${guest.last_name || ''}`.trim()
                            : 'Unknown'}
                        </div>
                        {guest.email && (
                          <div className="text-sm text-gray-500">{guest.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {guest.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {guest.allergies && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                          Allergies
                        </span>
                      )}
                      {guest.dietary_preferences && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                          Dietary
                        </span>
                      )}
                      {guest.favorite_cuisines && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                          Cuisines
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {guest.order_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.last_order_at
                      ? new Date(guest.last_order_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} guests
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {showDetail && selectedGuest && (
        <GuestDetailDialog
          guest={selectedGuest}
          onClose={handleCloseDetail}
          onUpdate={handleGuestUpdated}
        />
      )}
    </div>
  );
}
