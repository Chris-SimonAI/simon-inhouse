interface RestaurantsPageProps {
  locationId: number;
  locationName: string;
  onSelectRestaurant: (restaurantId: number) => void;
  onBack: () => void;
}

export function RestaurantsPage({ locationId, locationName, onBack }: RestaurantsPageProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-700">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold">Restaurants at {locationName}</h2>
      </div>
      <p className="text-gray-500">Location ID: {locationId}</p>
      <p className="text-gray-500 mt-2">Restaurant management coming soon.</p>
    </div>
  );
}
