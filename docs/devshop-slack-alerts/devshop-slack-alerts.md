# Dev-Shop Slack Alerts (Links You Can Send)

These are copy/paste drop-ins for the dev-shop codebase:

- `order-created-slack-alert.md`: posts to Slack when an order is created.
- `order-stuck-watchdog.md`: scheduled job that alerts if `requested_to_toast` lasts > N minutes (default 6).

Both require a Slack **Incoming Webhook URL** (not a channel URL).

Your requested admin URL to embed in alerts:

- `https://app.meetsimon.ai/ocean-park/admin/orders`

