import { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, DollarSign, TrendingUp, Users, RefreshCw } from 'lucide-react';
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
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { API_BASE } from '../config';
import { StatCard } from '../components/admin/stat-card';
import { ChartContainer } from '../components/admin/chart-container';
import { DateRangePicker } from '../components/admin/date-range-picker';

interface Summary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  uniqueGuests: number;
}

interface TimeSeriesData {
  date: string;
  orders: number;
  revenue: number;
}

interface StatusData {
  status: string;
  count: number;
}

interface RestaurantData {
  restaurant_id: number;
  restaurant_name: string;
  order_count: number;
  revenue: number;
}

interface ItemData {
  itemName: string;
  quantity: number;
  revenue: number;
}

interface GuestMetrics {
  newGuests: number;
  returningGuests: number;
  frequencyDistribution: { order_count: number; guest_count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  });

  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantData[]>([]);
  const [topItems, setTopItems] = useState<ItemData[]>([]);
  const [guestMetrics, setGuestMetrics] = useState<GuestMetrics | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    return params.toString();
  }, [dateRange]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const queryStr = buildParams();

    try {
      const [summaryRes, timeSeriesRes, statusRes, restaurantsRes, itemsRes, guestsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/analytics/summary?${queryStr}`),
        fetch(`${API_BASE}/api/admin/analytics/orders-time-series?${queryStr}&granularity=day`),
        fetch(`${API_BASE}/api/admin/analytics/orders-by-status?${queryStr}`),
        fetch(`${API_BASE}/api/admin/analytics/top-restaurants?${queryStr}&limit=10`),
        fetch(`${API_BASE}/api/admin/analytics/top-items?${queryStr}&limit=10`),
        fetch(`${API_BASE}/api/admin/analytics/guest-metrics?${queryStr}`)
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (timeSeriesRes.ok) setTimeSeries(await timeSeriesRes.json());
      if (statusRes.ok) setStatusData(await statusRes.json());
      if (restaurantsRes.ok) setTopRestaurants(await restaurantsRes.json());
      if (itemsRes.ok) setTopItems(await itemsRes.json());
      if (guestsRes.ok) setGuestMetrics(await guestsRes.json());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const pieData = statusData.map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || '#9ca3af'
  }));

  const guestPieData = guestMetrics ? [
    { name: 'New Guests', value: guestMetrics.newGuests, color: '#22c55e' },
    { name: 'Returning', value: guestMetrics.returningGuests, color: '#3b82f6' }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Analytics</h2>
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={summary?.totalOrders || 0}
          icon={ShoppingBag}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary?.totalRevenue || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(summary?.avgOrderValue || 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Unique Guests"
          value={summary?.uniqueGuests || 0}
          icon={Users}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Over Time */}
        <ChartContainer
          title="Orders Over Time"
          className="lg:col-span-2"
          loading={loading}
        >
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Orders"
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>

        {/* Orders by Status */}
        <ChartContainer title="Orders by Status" loading={loading}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Restaurants */}
        <ChartContainer title="Top Restaurants" loading={loading}>
          {topRestaurants.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topRestaurants}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="restaurant_name"
                  tick={{ fontSize: 12 }}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>

        {/* Top Menu Items */}
        <ChartContainer title="Top Menu Items" loading={loading}>
          {topItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topItems}
                layout="vertical"
                margin={{ left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="itemName"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Quantity']}
                />
                <Bar dataKey="quantity" fill="#8b5cf6" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Charts Row 3 - Guest Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New vs Returning */}
        <ChartContainer title="New vs Returning Guests" loading={loading}>
          {guestPieData.length > 0 && (guestMetrics?.newGuests || 0) + (guestMetrics?.returningGuests || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={guestPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {guestPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>

        {/* Order Frequency */}
        <ChartContainer title="Order Frequency Distribution" loading={loading}>
          {guestMetrics?.frequencyDistribution && guestMetrics.frequencyDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={guestMetrics.frequencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="order_count"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Orders per Guest', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Number of Guests', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Guests']}
                  labelFormatter={(label) => `${label} order(s)`}
                />
                <Bar dataKey="guest_count" fill="#f59e0b" name="Guests" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data for selected period
            </div>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
