import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ShoppingBag, Utensils, TrendingUp } from "lucide-react";
import { getAllHotels } from "@/actions/hotels";
import { db } from "@/db";
import { dineInRestaurants, dineInOrders } from "@/db/schemas";
import { count } from "drizzle-orm";

export default async function AdminPage() {
  const hotelsResult = await getAllHotels();
  const hotelCount = hotelsResult.ok ? hotelsResult.data.length : 0;

  const [restaurantCount] = await db.select({ count: count() }).from(dineInRestaurants);
  const [orderCount] = await db.select({ count: count() }).from(dineInOrders);

  const stats = [
    { label: "Hotels", value: hotelCount, icon: Building2, color: "bg-blue-500" },
    { label: "Restaurants", value: restaurantCount.count, icon: Utensils, color: "bg-green-500" },
    { label: "Orders", value: orderCount.count, icon: ShoppingBag, color: "bg-purple-500" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your hotels and restaurants</p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/admin/hotels/new"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Building2 className="w-5 h-5 text-slate-600" />
              <span className="font-medium">Add New Hotel</span>
            </a>
            <a
              href="/admin/library"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Utensils className="w-5 h-5 text-slate-600" />
              <span className="font-medium">Manage Restaurants</span>
            </a>
            <a
              href="/admin/orders"
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-slate-600" />
              <span className="font-medium">View Orders</span>
            </a>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-600 space-y-4">
            <p>
              <strong>1. Add a hotel</strong> - Create a new location where guests will order from.
            </p>
            <p>
              <strong>2. Add restaurants</strong> - Scrape menus from Toast using the "Add Restaurant" button.
            </p>
            <p>
              <strong>3. Approve restaurants</strong> - Review and approve restaurants to make them visible to guests.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
