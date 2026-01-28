import {
  getAnalyticsSummary,
  getOrdersTimeSeries,
  getOrdersByStatus,
  getTopRestaurants,
  getTopMenuItems,
  getGuestMetrics,
} from "@/actions/analytics";
import { StatCard } from "@/components/admin/stat-card";
import { ShoppingBag, DollarSign, TrendingUp, Users } from "lucide-react";
import { AnalyticsCharts } from "./analytics-charts";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const days = parseInt(params.days || "30", 10);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [summary, timeSeries, statusData, topRestaurants, topItems, guestMetrics] = await Promise.all([
    getAnalyticsSummary({ startDate, endDate }),
    getOrdersTimeSeries({ startDate, endDate, granularity: days > 60 ? 'week' : 'day' }),
    getOrdersByStatus({ startDate, endDate }),
    getTopRestaurants({ startDate, endDate, limit: 10 }),
    getTopMenuItems({ startDate, endDate, limit: 10 }),
    getGuestMetrics({ startDate, endDate }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">
            Last {days} days overview
          </p>
        </div>
        <DateRangeSelector currentDays={days} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Orders"
          value={summary.totalOrders}
          icon={ShoppingBag}
        />
        <StatCard
          label="Total Revenue"
          value={`$${summary.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard
          label="Avg Order Value"
          value={`$${summary.avgOrderValue.toFixed(2)}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Unique Guests"
          value={summary.uniqueGuests}
          icon={Users}
          subtitle={`${guestMetrics.returningGuests} returning`}
        />
      </div>

      {/* Charts */}
      <AnalyticsCharts
        timeSeries={timeSeries}
        statusData={statusData}
        topRestaurants={topRestaurants}
        topItems={topItems}
        guestMetrics={guestMetrics}
      />
    </div>
  );
}

function DateRangeSelector({ currentDays }: { currentDays: number }) {
  const options = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "All time", value: 365 },
  ];

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <a
          key={option.value}
          href={`/admin/analytics?days=${option.value}`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentDays === option.value
              ? "bg-slate-900 text-white"
              : "bg-white border text-slate-600 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </a>
      ))}
    </div>
  );
}
