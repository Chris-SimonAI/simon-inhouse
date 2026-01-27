import { getAllDineInOrders } from "@/actions/dine-in-orders";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Clock, CheckCircle, XCircle, Truck, AlertCircle, CreditCard, Bot, Send } from "lucide-react";

function getStatusBadge(status: string) {
  switch (status) {
    case "delivered":
      return { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Delivered" };
    case "confirmed":
      return { color: "bg-blue-100 text-blue-700", icon: CheckCircle, label: "Confirmed" };
    case "pending":
      return { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: "Pending" };
    case "cancelled":
      return { color: "bg-red-100 text-red-700", icon: XCircle, label: "Cancelled" };
    case "failed":
      return { color: "bg-red-100 text-red-700", icon: AlertCircle, label: "Failed" };
    case "requested_to_toast":
      return { color: "bg-indigo-100 text-indigo-700", icon: Send, label: "Sent to Bot" };
    case "toast_ordered":
      return { color: "bg-purple-100 text-purple-700", icon: Truck, label: "Ordered on Toast" };
    case "toast_ok_capture_failed":
      return { color: "bg-orange-100 text-orange-700", icon: CreditCard, label: "Payment Capture Failed" };
    default:
      return { color: "bg-slate-100 text-slate-700", icon: Clock, label: status };
  }
}

function getBotStatusBadge(botStatus: string | undefined) {
  if (!botStatus) return null;
  switch (botStatus) {
    case "success":
      return { color: "bg-green-50 text-green-600", label: "Bot: Success" };
    case "processing":
      return { color: "bg-blue-50 text-blue-600", label: "Bot: Processing" };
    case "pending":
      return { color: "bg-yellow-50 text-yellow-600", label: "Bot: Pending" };
    default:
      return { color: "bg-red-50 text-red-600", label: `Bot: ${botStatus}` };
  }
}

function getPaymentStatusBadge(paymentStatus: string | undefined) {
  if (!paymentStatus) return null;
  switch (paymentStatus) {
    case "succeeded":
      return { color: "bg-green-50 text-green-600", icon: CreditCard, label: "Paid" };
    case "authorized":
      return { color: "bg-blue-50 text-blue-600", icon: CreditCard, label: "Authorized" };
    case "pending":
      return { color: "bg-yellow-50 text-yellow-600", icon: CreditCard, label: "Payment Pending" };
    case "failed":
      return { color: "bg-red-50 text-red-600", icon: CreditCard, label: "Payment Failed" };
    case "cancelled":
      return { color: "bg-red-50 text-red-600", icon: XCircle, label: "Payment Cancelled" };
    default:
      return { color: "bg-slate-50 text-slate-600", icon: CreditCard, label: paymentStatus };
  }
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function OrdersPage() {
  const result = await getAllDineInOrders();
  const orders = result.ok ? result.data : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
        <p className="text-slate-500 mt-1">
          {orders.length} orders across all hotels
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Order</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Guest</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Restaurant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Room</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Total</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Order Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Payment</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => {
              const status = getStatusBadge(order.orderStatus);
              const StatusIcon = status.icon;
              const botStatus = getBotStatusBadge(order.botStatus ?? undefined);
              const paymentStatus = getPaymentStatusBadge(order.paymentStatus ?? undefined);
              return (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">#{order.id}</div>
                    <div className="text-xs text-slate-400">{order.hotelName || "—"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-900">{order.fullName || "—"}</div>
                    {order.contactEmail && (
                      <div className="text-xs text-slate-500">{order.contactEmail}</div>
                    )}
                    {order.contactPhone && (
                      <div className="text-xs text-slate-400">{order.contactPhone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {order.restaurantName || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{order.roomNumber}</Badge>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    ${order.totalAmount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {botStatus && (
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${botStatus.color}`}>
                            <Bot className="w-3 h-3" />
                            {botStatus.label}
                          </span>
                        </div>
                      )}
                      {order.errorReason && (
                        <div className="text-xs text-red-600">{order.errorReason}</div>
                      )}
                      {order.botError && (
                        <div className="text-xs text-red-500">{order.botError}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {paymentStatus ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatus.color}`}>
                        {paymentStatus.icon && <paymentStatus.icon className="w-3 h-3" />}
                        {paymentStatus.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No payment</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No orders yet</p>
            <p className="mt-1">Orders will appear here once guests start placing them.</p>
          </div>
        )}
      </div>
    </div>
  );
}
