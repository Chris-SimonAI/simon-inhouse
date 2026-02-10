import { extractCanonicalOrderArtifact } from '@/lib/orders/canonical-order-artifact';

export interface OrderCreatedAlertPayload {
  alertVersion: 'v1';
  createdAt: string;
  orderId: number;
  orderStatus: string;
  hotel: { id: number; name: string; slug: string | null };
  restaurant: { id: number; name: string };
  guest: { name: string | null; phone: string | null; email: string | null; roomNumber: string };
  totalAmount: string;
  items: Array<{ name: string; quantity: number; modifiers: string[] }>;
  adminUrl: string;
}

export function buildOrderCreatedAlertPayload(input: {
  orderId: number;
  orderStatus: string;
  hotel: { id: number; name: string; slug: string | null };
  restaurant: { id: number; name: string };
  guest: { name: string | null; phone: string | null; email: string | null; roomNumber: string };
  totalAmount: string;
  metadata: unknown;
  fallbackItems: Array<{ name: string; quantity: number; modifiers?: string[] }>;
  adminBaseUrl: string;
}): OrderCreatedAlertPayload {
  const canonical = extractCanonicalOrderArtifact(input.metadata);
  const canonicalItems =
    canonical?.items.map((item) => ({
      name: item.itemName,
      quantity: item.quantity,
      modifiers: item.modifierDetails.flatMap((group) =>
        group.options.map((option) => option.optionName),
      ),
    })) ?? [];

  const items =
    canonicalItems.length > 0
      ? canonicalItems
      : input.fallbackItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          modifiers: item.modifiers ?? [],
        }));

  return {
    alertVersion: 'v1',
    createdAt: new Date().toISOString(),
    orderId: input.orderId,
    orderStatus: input.orderStatus,
    hotel: input.hotel,
    restaurant: input.restaurant,
    guest: input.guest,
    totalAmount: input.totalAmount,
    items,
    // Hotel-scoped admin when slug exists; otherwise global admin.
    adminUrl: input.hotel.slug
      ? `${input.adminBaseUrl}/${input.hotel.slug}/admin/orders`
      : `${input.adminBaseUrl}/admin/orders`,
  };
}

export function formatOrderCreatedSlackMessage(payload: OrderCreatedAlertPayload): string {
  const itemSummary = payload.items
    .slice(0, 6)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ');

  return [
    `*NEW ORDER*`,
    `Order #${payload.orderId} | status: ${payload.orderStatus} | total: $${payload.totalAmount}`,
    `Hotel: ${payload.hotel.name}${payload.hotel.slug ? ` (${payload.hotel.slug})` : ''} | Room: ${payload.guest.roomNumber}`,
    payload.guest.name ? `Guest: ${payload.guest.name}` : null,
    payload.guest.phone ? `Phone: ${payload.guest.phone}` : null,
    payload.guest.email ? `Email: ${payload.guest.email}` : null,
    `Restaurant: ${payload.restaurant.name}`,
    `Items: ${itemSummary || 'N/A'}`,
    `Admin: ${payload.adminUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function formatOrderCreatedSmsMessage(payload: OrderCreatedAlertPayload): string {
  const itemSummary = payload.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ');

  return [
    `NEW ORDER #${payload.orderId} $${payload.totalAmount}`,
    `Hotel ${payload.hotel.slug ?? payload.hotel.name}, room ${payload.guest.roomNumber}.`,
    itemSummary ? `Items: ${itemSummary}.` : null,
    `Open: ${payload.adminUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join(' ');
}
