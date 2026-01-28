import { useState, useEffect } from 'react';
import { X, Phone, Mail, User, Edit2, RefreshCw, Sparkles } from 'lucide-react';
import { API_BASE } from '../../config';
import { GuestEditForm } from './GuestEditForm';

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
}

interface Order {
  id: number;
  restaurant_name: string;
  location_name: string;
  status: string;
  order_total: number | null;
  items_json: string;
  created_at: string;
}

interface Recommendation {
  menuItemId: number;
  itemName: string;
  restaurantName: string;
  restaurantId: number;
  price: number;
  score: number;
  reasoning: string[];
}

interface GuestDetailDialogProps {
  guest: Guest;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  driver_assigned: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
};

export function GuestDetailDialog({ guest, onClose, onUpdate }: GuestDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'recommendations'>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentGuest, setCurrentGuest] = useState(guest);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/guests/${guest.id}/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/guests/${guest.id}/recommendations`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders' && orders.length === 0) {
      fetchOrders();
    }
    if (activeTab === 'recommendations' && recommendations.length === 0) {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSave = async (data: {
    dietary_preferences: string;
    allergies: string;
    favorite_cuisines: string;
    dislikes: string;
    notes: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const updated = await response.json();
        setCurrentGuest({ ...currentGuest, ...updated });
        setIsEditing(false);
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to update guest:', err);
    }
  };

  const renderPreferences = (label: string, value: string | null, colorClass: string) => {
    if (!value) return null;
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-500 mb-2">{label}</h4>
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span key={idx} className={`px-3 py-1 text-sm rounded-full ${colorClass}`}>
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {currentGuest.first_name || currentGuest.last_name
                ? `${currentGuest.first_name || ''} ${currentGuest.last_name || ''}`.trim()
                : 'Guest Profile'}
            </h2>
            <p className="text-sm text-gray-500">{currentGuest.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            {(['profile', 'orders', 'recommendations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'profile' && 'Profile'}
                {tab === 'orders' && `Orders (${currentGuest.order_count})`}
                {tab === 'recommendations' && 'Recommendations'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <div>
              {isEditing ? (
                <GuestEditForm
                  guest={currentGuest}
                  onSave={handleSave}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <>
                  {/* Contact Info */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        Contact Information
                      </h3>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{currentGuest.phone}</span>
                      </div>
                      {currentGuest.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{currentGuest.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>
                          {currentGuest.first_name || currentGuest.last_name
                            ? `${currentGuest.first_name || ''} ${currentGuest.last_name || ''}`.trim()
                            : 'Name not provided'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Preferences */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      Preferences
                    </h3>
                    {renderPreferences('Allergies', currentGuest.allergies, 'bg-red-100 text-red-800')}
                    {renderPreferences('Dietary Preferences', currentGuest.dietary_preferences, 'bg-green-100 text-green-800')}
                    {renderPreferences('Favorite Cuisines', currentGuest.favorite_cuisines, 'bg-blue-100 text-blue-800')}
                    {renderPreferences('Dislikes', currentGuest.dislikes, 'bg-orange-100 text-orange-800')}
                    {!currentGuest.allergies && !currentGuest.dietary_preferences && !currentGuest.favorite_cuisines && !currentGuest.dislikes && (
                      <p className="text-sm text-gray-500 italic">No preferences recorded</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      Notes
                    </h3>
                    {currentGuest.notes ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentGuest.notes}</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No notes</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              {loadingOrders ? (
                <div className="text-center py-8 text-gray-500">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No order history</div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">Order #{order.id}</span>
                          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                            {order.status}
                          </span>
                        </div>
                        {order.order_total && (
                          <span className="font-medium">${order.order_total.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.restaurant_name} - {order.location_name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                      {order.items_json && (
                        <div className="mt-2 text-sm text-gray-600">
                          {(() => {
                            try {
                              const items = JSON.parse(order.items_json);
                              return items.map((item: { quantity: number; name: string }, idx: number) => (
                                <span key={idx}>
                                  {idx > 0 && ', '}
                                  {item.quantity > 1 && `${item.quantity}x `}{item.name}
                                </span>
                              ));
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  AI-generated recommendations based on past orders and preferences
                </p>
                <button
                  onClick={fetchRecommendations}
                  disabled={loadingRecommendations}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingRecommendations ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loadingRecommendations ? (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-500 animate-pulse" />
                  Generating recommendations...
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No recommendations available. The guest needs more order history.
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{rec.itemName}</h4>
                          <p className="text-sm text-gray-500">{rec.restaurantName}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${rec.price.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">Score: {rec.score}</div>
                        </div>
                      </div>
                      {rec.reasoning.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.reasoning.map((reason, ridx) => (
                            <span
                              key={ridx}
                              className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
