# Dev-Shop Drop-In: `requested_to_toast` Stuck Watchdog (Slack)

This is a scheduled watchdog that alerts if an order stays in `requested_to_toast` for more than N minutes (default 6).

Why a watchdog is needed: an inline "plugin" can't detect something that does *not* happen (status never advances) unless a later job checks.

## Required env vars

- `DATABASE_URL`: Postgres connection string
- `OPS_ORDERS_SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL (looks like `https://hooks.slack.com/services/...`)

Optional:
- `OPS_ORDERS_ADMIN_URL`: `https://app.meetsimon.ai/ocean-park/admin/orders` (defaults to this)
- `OPS_ORDER_STUCK_MINUTES`: `6` (defaults to 6)

## Add file: `scripts/order-stuck-watchdog.ts`

```ts
import "dotenv/config";

import pg from "pg";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function parseJsonb(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

function getNestedString(obj: unknown, path: string[]): string | null {
  let cur: unknown = obj;
  for (const key of path) {
    cur = asRecord(cur)[key];
  }
  return typeof cur === "string" ? cur : null;
}

async function postToSlack(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed with status ${res.status}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const slackWebhookUrl = process.env.OPS_ORDERS_SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    console.log("OPS_ORDERS_SLACK_WEBHOOK_URL not set; exiting.");
    return;
  }

  const adminUrl =
    process.env.OPS_ORDERS_ADMIN_URL ??
    "https://app.meetsimon.ai/ocean-park/admin/orders";

  const stuckMinutes = Number(process.env.OPS_ORDER_STUCK_MINUTES ?? "6");
  if (!Number.isFinite(stuckMinutes) || stuckMinutes <= 0) {
    throw new Error("OPS_ORDER_STUCK_MINUTES must be a positive number");
  }

  const cutoffMs = Date.now() - stuckMinutes * 60_000;

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    // NOTE: This uses created_at because many codepaths don't bump updated_at on status transitions.
    // Prefer updated_at (or a dedicated requested_to_toast_at) once available.
    const { rows } = await pool.query<{
      id: number;
      created_at: string;
      room_number: string;
      total_amount: string;
      order_status: string;
      metadata: unknown;
      hotel_name: string | null;
      hotel_slug: string | null;
      restaurant_name: string | null;
    }>(
      `
      select
        o.id,
        o.created_at,
        o.room_number,
        o.total_amount,
        o.order_status,
        o.metadata,
        h.name as hotel_name,
        h.slug as hotel_slug,
        r.name as restaurant_name
      from dine_in_orders o
      left join hotels h on h.id = o.hotel_id
      left join dine_in_restaurants r on r.id = o.restaurant_id
      where o.order_status = $1
        and o.created_at < to_timestamp($2 / 1000.0)
      order by o.created_at asc
      limit 50
      `,
      ["requested_to_toast", cutoffMs],
    );

    let alerted = 0;

    for (const row of rows) {
      const metadata = parseJsonb(row.metadata);

      // If bot completed, it's not "stuck" anymore.
      if (getNestedString(metadata, ["botCompletedAt"])) continue;

      // Dedupe: alert once per order.
      if (getNestedString(metadata, ["opsAlerts", "requestedToToastStuckSentAt"])) continue;

      const createdAtMs = new Date(row.created_at).getTime();
      const ageMin = Math.max(0, Math.round((Date.now() - createdAtMs) / 60_000));

      const text = [
        "*ORDER STUCK*",
        `Order #${row.id} stuck in requested_to_toast for ~${ageMin} min`,
        `Hotel: ${row.hotel_name ?? "Unknown"}${row.hotel_slug ? ` (${row.hotel_slug})` : ""} | Room: ${row.room_number}`,
        `Restaurant: ${row.restaurant_name ?? "Unknown"}`,
        `Total: $${row.total_amount}`,
        `Admin: ${adminUrl}`,
      ].join("\\n");

      await postToSlack(slackWebhookUrl, text);
      alerted += 1;

      await pool.query(
        `
        update dine_in_orders
        set
          metadata = jsonb_set(
            coalesce(metadata, '{}'::jsonb),
            '{opsAlerts,requestedToToastStuckSentAt}',
            to_jsonb(now()::text),
            true
          ),
          updated_at = now()
        where id = $1
        `,
        [row.id],
      );
    }

    console.log(`Watchdog complete. Alerted: ${alerted}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Watchdog failed:", err);
  process.exitCode = 1;
});
```

## Schedule it (no manual running)

Run it every 1 minute using a scheduler (Railway Cron preferred):

```bash
node --import tsx scripts/order-stuck-watchdog.ts
```

If no scheduler is available yet, manual running is possible but not intended.

