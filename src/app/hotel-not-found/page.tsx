export default function HotelNotFoundPage() {
    return (
      <main className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="h-dvh w-full max-w-md flex items-center justify-center bg-white shadow-sm rounded-none">
          <div className="text-center px-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              No Hotel Found
            </h1>
            <p className="text-gray-600">
              Please scan a QR code to access the concierge service.
            </p>
          </div>
        </div>
      </main>
    );
  }
  