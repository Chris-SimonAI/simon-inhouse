// todo: Need to delete the file because of security issue

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
  "failed",
  "requested_to_toast",
  "toast_ordered",
  "toast_ok_capture_failed",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
  requested_to_toast: "Order Processing",
  toast_ordered: "Processing payment",
  toast_ok_capture_failed: "Payment capture failed",
};

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export const ORDER_FILTERS: ReadonlyArray<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: ORDER_STATUS_LABELS.pending },
  { value: "requested_to_toast", label: ORDER_STATUS_LABELS.requested_to_toast },
  { value: "toast_ordered", label: ORDER_STATUS_LABELS.toast_ordered },
  { value: "failed", label: ORDER_STATUS_LABELS.failed },
  { value: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
];


