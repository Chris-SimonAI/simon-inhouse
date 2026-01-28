export const metadata = {
  title: "Terms of Service | Simon",
  description: "Terms of Service for Simon hotel guest services",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>

        <p className="text-sm text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p className="text-gray-700">
              Simon is a hotel guest services platform that enables guests to order food,
              access hotel amenities, and communicate with hotel services via web and SMS.
              By using Simon, you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. SMS Messaging Terms</h2>
            <p className="text-gray-700 mb-3">
              By providing your phone number and placing an order through Simon, you consent
              to receive SMS messages related to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Order confirmations and status updates</li>
              <li>Payment links and receipts</li>
              <li>Delivery notifications</li>
              <li>Responses to your food ordering requests</li>
              <li>Service announcements related to your orders</li>
            </ul>
            <p className="text-gray-700 mt-3">
              <strong>Message frequency:</strong> Message frequency varies based on your orders and interactions.
              Typically 2-10 messages per order.
            </p>
            <p className="text-gray-700 mt-3">
              <strong>Message and data rates may apply.</strong> Check with your carrier for details.
            </p>
            <p className="text-gray-700 mt-3">
              <strong>To opt out:</strong> Reply STOP to any message to unsubscribe from SMS notifications.
              You will receive a confirmation message and no further messages will be sent.
            </p>
            <p className="text-gray-700 mt-3">
              <strong>For help:</strong> Reply HELP to any message or contact support at help@meetsimon.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Food Ordering</h2>
            <p className="text-gray-700">
              Simon facilitates food orders from hotel restaurants. Prices, availability, and
              delivery times are determined by each restaurant. Payment is processed securely
              through Stripe. Orders are subject to restaurant acceptance and availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Privacy</h2>
            <p className="text-gray-700">
              We collect your phone number, name, and order history to provide our services.
              We do not sell your personal information. Your data is used only to fulfill
              orders and improve your experience. For questions about your data, contact
              privacy@meetsimon.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Allergies and Dietary Restrictions</h2>
            <p className="text-gray-700">
              While Simon tracks your stated allergies and dietary preferences, you are
              responsible for verifying ingredients with the restaurant. Simon and partner
              restaurants are not liable for allergic reactions. Always confirm with
              restaurant staff if you have severe allergies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact</h2>
            <p className="text-gray-700">
              For questions about these terms or our services:<br />
              Email: help@meetsimon.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
