interface LocationsPageProps {
  onSelectLocation: (locationId: number, locationName: string) => void;
}

export function LocationsPage({ onSelectLocation }: LocationsPageProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Locations</h2>
      <p className="text-gray-500">Location management coming soon.</p>
      <button
        onClick={() => onSelectLocation(1, 'Demo Location')}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        View Demo Location
      </button>
    </div>
  );
}
