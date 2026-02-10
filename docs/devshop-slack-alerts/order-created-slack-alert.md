# Dev-Shop Drop-In: Order Created Slack Alert

This is a copy/paste "plugin" for the dev-shop app so it can post to Slack when an order is created.

## 0) Required env vars

- `OPS_ORDERS_SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL (looks like `https://hooks.slack.com/services/...`)
- `NEXT_PUBLIC_APP_URL`: `https://app.meetsimon.ai` (already used in their app)

Optional:
- `OPS_ORDERS_ADMIN_URL`: `https://app.meetsimon.ai/ocean-park/admin/orders` (if you want a fixed link; otherwise derive from hotel slug)

## 1) Add file: `src/lib/order-created-slack-alert.ts`

```ts
import "server-only";

export type OrderCreatedSlackAlertInput = {
  webhookUrl: string | undefined;
  adminUrl: string;
  order: { id: number; status: string; totalAmount: string };
  hotel: { name: string; slug: string | null; roomNumber: string };
  restaurant: { name: string };
  guest?: { name?: string | null; phone?: string | null; email?: string | null };
  items: Array<{ name: string; quantity: number; modifiers?: string[] }>;
};

export async function notifySlackOrderCreated(input: OrderCreatedSlackAlertInput): Promise<void> {
  if (!input.webhookUrl) {
    return;
  }

  const itemSummary = input.items
    .slice(0, 6)
    .map((it) => `${it.quantity}x ${it.name}`)
    .join(", ");

  const lines = [
    "*NEW ORDER*",
    `Order #${input.order.id} | status: ${input.order.status} | total: $${input.order.totalAmount}`,
    `Hotel: ${input.hotel.name}${input.hotel.slug ? ` (${input.hotel.slug})` : ""} | Room: ${input.hotel.roomNumber}`,
    input.guest?.name ? `Guest: ${input.guest.name}` : null,
    input.guest?.phone ? `Phone: ${input.guest.phone}` : null,
    input.guest?.email ? `Email: ${input.guest.email}` : null,
    `Restaurant: ${input.restaurant.name}`,
    `Items: ${itemSummary || "N/A"}`,
    `Admin: ${input.adminUrl}`,
  ].filter((line): line is string => Boolean(line));

  const res = await fetch(input.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed with status ${res.status}`);
  }
}
```

## 2) Call it from order creation (example: `src/actions/payments.ts`)

After the order is inserted and after hotel + restaurant are loaded:

```ts
import { notifySlackOrderCreated } from "@/lib/order-created-slack-alert";

// ...

const fixedAdminUrl =
  process.env.OPS_ORDERS_ADMIN_URL ?? `${env.NEXT_PUBLIC_APP_URL}/ocean-park/admin/orders`;

try {
  const hotelRow = hotel[0];
  const restaurantRow = restaurant[0];

  if (hotelRow && restaurantRow) {
    await notifySlackOrderCreated({
      webhookUrl: process.env.OPS_ORDERS_SLACK_WEBHOOK_URL,
      adminUrl: fixedAdminUrl,
      order: { id: order.id, status: order.orderStatus, totalAmount: order.totalAmount },
      hotel: {
        name: hotelRow.name,
        slug: hotelRow.slug ?? null,
        roomNumber: order.roomNumber,
      },
      restaurant: { name: restaurantRow.name },
      guest: {
        name: validatedInput.fullName,
        phone: validatedInput.phoneNumber,
        email: validatedInput.email,
      },
      items: calculation.items.map((it) => ({
        name: it.itemName,
        quantity: it.quantity,
        modifiers: it.modifierDetails.flatMap((group) =>
          group.options.map((opt) => opt.optionName),
        ),
      })),
    });
  }
} catch (err) {
  console.error("[ops] order-created slack alert failed", err);
}
```

