import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, ChevronDown, ChevronUp, ExternalLink, Phone, Mail, CheckCircle2, Circle, XCircle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { API_BASE } from '../config';
import { DateRangePicker } from '../components/admin/date-range-picker';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface TimelineEntry {
  status: string;
  message: string;
  created_at: string;
}

interface Order {
  id: number;
  location_id: number;
  restaurant_id: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string;
  guest_email: string | null;
  generated_email: string;
  twilio_phone: string | null;
  status: string;
  external_order_id: string | null;
  items_json: string;
  order_total: number | null;
  created_at: string;
  updated_at: string;
  restaurant_name: string;
  location_name: string;
  timeline?: TimelineEntry[];
}

interface StatusData {
  status: string;
  count: number;
}

interface TimeSeriesData {
  date: string;
  orders: number;
  revenue: number;
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

const PIE_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  driver_assigned: '#6366f1',
  en_route: '#06b6d4',
  delivered: '#22c55e',
  failed: '#ef4444'
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  driver_assigned: 'Driver Assigned',
  en_route: 'On the Way',
  delivered: 'Delivered',
  failed: 'Failed'
};

const ALL_STATUSES = ['pending', 'confirmed', 'preparing', 'driver_assigned', 'en_route', 'delivered', 'failed'];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [showCharts, setShowCharts] = useState(true);

  // Date range
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Chart data
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`${API_BASE}/api/admin/orders/filtered?${params}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [dateRange, debouncedSearch, statusFilter, page]);

  const fetchChartData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);

      const [statusRes, timeSeriesRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/analytics/orders-by-status?${params}`),
        fetch(`${API_BASE}/api/admin/analytics/orders-time-series?${params}&granularity=day`)
      ]);

      if (statusRes.ok) setStatusData(await statusRes.json());
      if (timeSeriesRes.ok) setTimeSeries(await timeSeriesRes.json());
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
      fetchChartData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchChartData]);

  const fetchOrderDetails = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/tracked-orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, timeline: data.timeline } : o));
    } catch (err) {
      console.error('Failed to fetch order details:', err);
    }
  };

  const handleExpand = (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      const order = orders.find(o => o.id === orderId);
      if (!order?.timeline) {
        fetchOrderDetails(orderId);
      }
    }
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      const response = await fetch(`${API_BASE}/api/admin/tracked-orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update status');
      const updated = await response.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      fetchChartData();
    } catch {
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const pieData = statusData.map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: PIE_COLORS[d.status] || '#9ca3af'
  }));

  if (loading && orders.length === 0) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  if (error && orders.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Order Tracking</h2>
          <button
            onClick={() => { fetchOrders(); fetchChartData(); }}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-sm text-gray-500">
          {total} order{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Date Range */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Charts Section */}
      <Collapsible open={showCharts} onOpenChange={setShowCharts}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            <BarChart3 className="w-4 h-4" />
            {showCharts ? 'Hide Charts' : 'Show Charts'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showCharts ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Orders Over Time */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Orders Over Time</h3>
              {timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number) => [value, 'Orders']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No data for selected period
                </div>
              )}
            </div>

            {/* Orders by Status */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Orders by Status</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No data for selected period
                </div>
              )}
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {pieData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
                    <span>{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, order ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(status => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {searchQuery || statusFilter || dateRange.startDate ? 'No orders match your filters' : 'No orders yet'}
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-white rounded-lg shadow">
              {/* Order Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => handleExpand(order.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">Order #{order.id}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {order.guest_first_name} {order.guest_last_name} - {order.restaurant_name}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {order.location_name} - {formatDate(order.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.order_total && (
                      <span className="text-sm font-medium">${order.order_total.toFixed(2)}</span>
                    )}
                    {expandedOrder === order.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedOrder === order.id && (
                <div className="border-t px-4 py-4 space-y-4">
                  {/* Guest Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Guest Information</h4>
                      <div className="space-y-1">
                        <p>{order.guest_first_name} {order.guest_last_name}</p>
                        <p className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" /> {order.guest_phone}
                        </p>
                        {order.guest_email && (
                          <p className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4" /> {order.guest_email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Order Contact</h4>
                      <div className="space-y-1 text-gray-600">
                        <p className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> {order.generated_email}
                        </p>
                        {order.twilio_phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-4 h-4" /> {order.twilio_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Order Items</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      {(() => {
                        try {
                          const items = JSON.parse(order.items_json || '[]');
                          return items.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                              {items.map((item: { quantity: number; name: string; price: number }, idx: number) => (
                                <li key={idx} className="flex justify-between">
                                  <span>{item.quantity}x {item.name}</span>
                                  {item.price > 0 && <span>${(item.price * item.quantity).toFixed(2)}</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-500 text-sm">No items recorded</p>
                          );
                        } catch {
                          return <p className="text-gray-500 text-sm">Unable to parse items</p>;
                        }
                      })()}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Status Timeline</h4>
                    {order.timeline ? (
                      <div className="space-y-2">
                        {order.timeline.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              entry.status === 'delivered' ? 'bg-green-100 text-green-600' :
                              entry.status === 'failed' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {entry.status === 'delivered' ? <CheckCircle2 className="w-4 h-4" /> :
                               entry.status === 'failed' ? <XCircle className="w-4 h-4" /> :
                               <Circle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{STATUS_LABELS[entry.status] || entry.status}</p>
                              <p className="text-gray-500">{entry.message}</p>
                              <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Loading timeline...</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Update Status:</span>
                      <select
                        value=""
                        onChange={e => {
                          if (e.target.value) handleUpdateStatus(order.id, e.target.value);
                        }}
                        disabled={updatingStatus === order.id}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select...</option>
                        {ALL_STATUSES.filter(s => s !== order.status).map(status => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </div>
                    <a
                      href={`/track/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Tracking Page <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} orders
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
  );
}
