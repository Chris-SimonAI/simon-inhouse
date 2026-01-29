'use client';

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
  Legend,
} from "recharts";

interface AnalyticsChartsProps {
  timeSeries: Array<{ date: string; orders: number; revenue: number }>;
  statusData: Array<{ status: string; count: number }>;
  topRestaurants: Array<{ restaurantName: string; orderCount: number; revenue: number }>;
  topItems: Array<{ itemName: string; quantity: number; revenue: number }>;
  guestMetrics: {
    newGuests: number;
    returningGuests: number;
    frequencyDistribution: Array<{ orderCount: string; guests: number }>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "#10b981",
  confirmed: "#3b82f6",
  pending: "#f59e0b",
  cancelled: "#ef4444",
  failed: "#dc2626",
  requested_to_toast: "#6366f1",
  toast_ordered: "#8b5cf6",
  toast_ok_capture_failed: "#f97316",
};

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#06b6d4", "#3b82f6", "#f59e0b"];

export function AnalyticsCharts({
  timeSeries,
  statusData,
  topRestaurants,
  topItems,
  guestMetrics,
}: AnalyticsChartsProps) {
  const guestTypeData = [
    { name: "New", value: guestMetrics.newGuests },
    { name: "Returning", value: guestMetrics.returningGuests },
  ];

  return (
    <div className="space-y-6">
      {/* Orders Over Time */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-5">Orders Over Time</h3>
        {timeSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "revenue" ? `$${value.toFixed(2)}` : value,
                  name === "revenue" ? "Revenue" : "Orders",
                ]}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Orders"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            No data available
          </div>
        )}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-5">Orders by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => `${formatStatus(status)}: ${count}`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.status] || CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, formatStatus(name)]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* Guest Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-5">Guest Types</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={guestTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#22c55e" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{guestMetrics.newGuests}</div>
                  <div className="text-sm text-slate-500">New guests</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-green-500" />
                <div>
                  <div className="text-2xl font-bold">{guestMetrics.returningGuests}</div>
                  <div className="text-sm text-slate-500">Returning guests</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Restaurants */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-5">Top Restaurants</h3>
        {topRestaurants.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topRestaurants} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="restaurantName"
                tick={{ fontSize: 12 }}
                width={150}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "revenue" ? `$${value.toFixed(2)}` : value,
                  name === "revenue" ? "Revenue" : "Orders",
                ]}
              />
              <Legend />
              <Bar dataKey="orderCount" fill="#3b82f6" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            No data available
          </div>
        )}
      </div>

      {/* Top Menu Items */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-5">Top Menu Items</h3>
        {topItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="itemName"
                tick={{ fontSize: 12 }}
                width={150}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "revenue" ? `$${value.toFixed(2)}` : value,
                  name === "revenue" ? "Revenue" : "Quantity",
                ]}
              />
              <Legend />
              <Bar dataKey="quantity" fill="#8b5cf6" name="Quantity" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
