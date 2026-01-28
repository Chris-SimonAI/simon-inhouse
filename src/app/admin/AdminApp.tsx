import { useState } from 'react';
import { LocationsPage } from './LocationsPage';
import { RestaurantsPage } from './RestaurantsPage';
import { MetricsPage } from './MetricsPage';
import { ErrorLogPage } from './ErrorLogPage';
import { RestaurantHealthPage } from './RestaurantHealthPage';
import { MenuLibraryPage } from './MenuLibraryPage';
import { OrdersPage } from './OrdersPage';
import { TwilioSettingsPage } from './TwilioSettingsPage';
import { GuestsPage } from './GuestsPage';
import { AnalyticsPage } from './AnalyticsPage';

type AdminView = 'locations' | 'restaurants' | 'metrics' | 'errors' | 'health' | 'library' | 'orders' | 'settings' | 'guests' | 'analytics';

interface SelectedContext {
  locationId?: number;
  locationName?: string;
}

export function AdminApp() {
  const [currentView, setCurrentView] = useState<AdminView>('locations');
  const [selectedContext, setSelectedContext] = useState<SelectedContext>({});

  const handleSelectLocation = (locationId: number, locationName: string) => {
    setSelectedContext({ locationId, locationName });
    setCurrentView('restaurants');
  };

  const handleBackToLocations = () => {
    setSelectedContext({});
    setCurrentView('locations');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Simon Admin</h1>
              {/* Breadcrumb navigation for content management */}
              {(currentView === 'locations' || currentView === 'restaurants') && (
                <nav className="flex gap-2 text-sm text-gray-500">
                  <button
                    onClick={handleBackToLocations}
                    className={currentView === 'locations' ? 'text-blue-600 font-medium' : 'hover:text-gray-700'}
                  >
                    Locations
                  </button>
                  {selectedContext.locationName && (
                    <>
                      <span>/</span>
                      <span className="text-blue-600 font-medium">{selectedContext.locationName}</span>
                    </>
                  )}
                </nav>
              )}
            </div>
          </div>
          {/* Main navigation tabs */}
          <div className="mt-4 flex gap-1 border-b border-gray-200 -mb-px">
            <button
              onClick={handleBackToLocations}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'locations' || currentView === 'restaurants'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setCurrentView('metrics')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'metrics'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Metrics
            </button>
            <button
              onClick={() => setCurrentView('errors')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'errors'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Error Log
            </button>
            <button
              onClick={() => setCurrentView('health')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'health'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Restaurant Health
            </button>
            <button
              onClick={() => setCurrentView('library')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'library'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Menu Library
            </button>
            <button
              onClick={() => setCurrentView('orders')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'orders'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setCurrentView('guests')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'guests'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Guests
            </button>
            <button
              onClick={() => setCurrentView('analytics')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'analytics'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                currentView === 'settings'
                  ? 'bg-blue-50 text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {currentView === 'locations' && (
          <LocationsPage onSelectLocation={handleSelectLocation} />
        )}
        {currentView === 'restaurants' && selectedContext.locationId && (
          <RestaurantsPage
            locationId={selectedContext.locationId}
            locationName={selectedContext.locationName || ''}
            onSelectRestaurant={() => {}} // No longer used - menu editing is in Library
            onBack={handleBackToLocations}
          />
        )}
        {currentView === 'metrics' && <MetricsPage />}
        {currentView === 'errors' && <ErrorLogPage />}
        {currentView === 'health' && <RestaurantHealthPage />}
        {currentView === 'library' && <MenuLibraryPage />}
        {currentView === 'orders' && <OrdersPage />}
        {currentView === 'guests' && <GuestsPage />}
        {currentView === 'analytics' && <AnalyticsPage />}
        {currentView === 'settings' && <TwilioSettingsPage />}
      </main>
    </div>
  );
}
