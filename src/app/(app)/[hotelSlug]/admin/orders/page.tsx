import { requireHotelSession } from "@/utils/require-hotel-session";
import { getDineInOrdersForHotel } from "@/actions/dine-in-orders";
import OrdersFilter from "./orders-filter";
import OrderCard from "@/components/order/order-card";
import { ORDER_STATUSES, getOrderStatusLabel, type OrderStatus } from "@/constants/orders";

type PageProps = {
  params: Promise<{ hotelSlug: string }>;
  searchParams: Promise<{ status?: string }>;
};

type OrderCardData = {
  id: number;
  createdAt: Date | string;
  orderStatus: OrderStatus;
  roomNumber: string;
  totalAmount: string;
  amount?: string;
  restaurantName: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  errorReason?: string | null;
  trackingUrl?: string | null;
  items?: Array<{ itemName: string; quantity: number; unitPrice: string; totalPrice: string }>;
};

export default async function OrdersPage({ params, searchParams }: PageProps) {
  const { hotelSlug } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/admin/orders`,
  });

  const sp = await searchParams;
  const statusParam = sp?.status && ORDER_STATUSES.includes(sp.status as (typeof ORDER_STATUSES)[number])
    ? (sp.status as (typeof ORDER_STATUSES)[number])
    : undefined;

  const statusLabel = (s?: OrderStatus) => (s ? getOrderStatusLabel(s) : undefined);

  const result = await getDineInOrdersForHotel(hotelSlug, statusParam);
  const orders = (result.ok ? result.data : []) as OrderCardData[];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6">
      <div className="relative isolate flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dine-in Orders</h1>
        <p className="text-sm text-muted-foreground">
          {statusParam ? `Filtered by: ${statusLabel(statusParam)}` : "All recent orders"} · {orders.length} total
        </p>
        <OrdersFilter />
      </div>

      {orders.length === 0 ? (
        <div className="text-sm text-muted-foreground">No orders found.</div>
      ) : (
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 gap-4 max-h-[80vh] overflow-y-auto pr-2">
            {orders.map((o) => (
              <div key={o.id} className="min-w-0">
                <OrderCard
                  id={o.id}
                  createdAt={o.createdAt}
                  orderStatus={o.orderStatus}
                  roomNumber={o.roomNumber}
                  totalAmount={o.totalAmount}
                  restaurantName={o.restaurantName}
                  contactEmail={o.contactEmail}
                  contactPhone={o.contactPhone}
                  errorReason={o.errorReason}
                  trackingUrl={o.trackingUrl}
                  items={o.items}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}


