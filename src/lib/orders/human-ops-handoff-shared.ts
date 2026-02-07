import { extractCanonicalOrderArtifact } from '@/lib/orders/canonical-order-artifact';

export type HumanOpsHandoffReason =
  | 'bot_failed'
  | 'bot_error'
  | 'capture_failed'
  | 'cancel_failed';

export interface HumanOpsHandoffPayload {
  handoffVersion: 'v1';
  createdAt: string;
  reason: HumanOpsHandoffReason;
  orderId: number;
  orderStatus: string;
  failureStage?: string;
  failureMessage?: string;
  guest: {
    name: string;
    phone: string;
    email: string;
    roomNumber: string;
  };
  hotel: {
    id: number;
    name: string;
    address: string;
  };
  restaurant: {
    id: number;
    name: string;
    sourceUrl: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
  }>;
  compiler: {
    itemCount: number;
    subtotal: number;
    compilerVersion: string;
  };
  adminUrl: string;
}

export function buildHumanOpsHandoffPayload(input: {
  reason: HumanOpsHandoffReason;
  orderId: number;
  orderStatus: string;
  failureStage?: string;
  failureMessage?: string;
  guest: {
    name: string;
    phone: string;
    email: string;
    roomNumber: string;
  };
  hotel: {
    id: number;
    name: string;
    address: string;
  };
  restaurant: {
    id: number;
    name: string;
    sourceUrl: string;
  };
  metadata: unknown;
  fallbackItems: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
  }>;
  adminBaseUrl: string;
}): HumanOpsHandoffPayload {
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
    handoffVersion: 'v1',
    createdAt: new Date().toISOString(),
    reason: input.reason,
    orderId: input.orderId,
    orderStatus: input.orderStatus,
    failureStage: input.failureStage,
    failureMessage: input.failureMessage,
    guest: input.guest,
    hotel: input.hotel,
    restaurant: input.restaurant,
    items,
    compiler: {
      itemCount: canonical?.itemCount ?? items.length,
      subtotal: canonical?.subtotal ?? 0,
      compilerVersion: canonical?.compilerVersion ?? 'unknown',
    },
    adminUrl: `${input.adminBaseUrl}/admin/orders`,
  };
}

export function formatSlackMessage(payload: HumanOpsHandoffPayload): string {
  const itemSummary = payload.items
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ');

  return [
    `*SIMON OPS HANDOFF REQUIRED*`,
    `Order #${payload.orderId} | reason: ${payload.reason}`,
    payload.failureStage ? `Stage: ${payload.failureStage}` : null,
    payload.failureMessage ? `Error: ${payload.failureMessage}` : null,
    `Hotel: ${payload.hotel.name} | Room: ${payload.guest.roomNumber}`,
    `Guest: ${payload.guest.name} (${payload.guest.phone})`,
    `Restaurant: ${payload.restaurant.name}`,
    `Items: ${itemSummary || 'N/A'}`,
    `Admin: ${payload.adminUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function formatSmsMessage(payload: HumanOpsHandoffPayload): string {
  const itemSummary = payload.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ');
  const stagePart = payload.failureStage ? ` ${payload.failureStage}` : '';

  return [
    `SIMON HANDOFF: Order #${payload.orderId}${stagePart}`,
    `Hotel ${payload.hotel.name}, room ${payload.guest.roomNumber}.`,
    `Guest ${payload.guest.name} ${payload.guest.phone}.`,
    `Restaurant ${payload.restaurant.name}.`,
    itemSummary ? `Items: ${itemSummary}.` : null,
    `Open: ${payload.adminUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join(' ');
}
