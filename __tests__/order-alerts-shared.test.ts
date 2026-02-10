import { describe, expect, it } from "vitest";

import {
  buildOrderCreatedAlertPayload,
  formatOrderCreatedSlackMessage,
} from "@/lib/orders/order-alerts-shared";

describe("order alerts", () => {
  it("builds a global admin url when hotel slug is null", () => {
    const payload = buildOrderCreatedAlertPayload({
      orderId: 123,
      orderStatus: "pending",
      hotel: { id: 1, name: "Ocean Park", slug: null },
      restaurant: { id: 2, name: "Test Restaurant" },
      guest: { name: null, phone: null, email: null, roomNumber: "412" },
      totalAmount: "10.00",
      metadata: {},
      fallbackItems: [{ name: "Burger", quantity: 1 }],
      adminBaseUrl: "https://app.meetsimon.ai",
    });

    expect(payload.adminUrl).toBe("https://app.meetsimon.ai/admin/orders");
  });

  it("builds a hotel-scoped admin url when hotel slug is present", () => {
    const payload = buildOrderCreatedAlertPayload({
      orderId: 124,
      orderStatus: "pending",
      hotel: { id: 1, name: "Ocean Park", slug: "ocean-park" },
      restaurant: { id: 2, name: "Test Restaurant" },
      guest: { name: null, phone: null, email: null, roomNumber: "412" },
      totalAmount: "10.00",
      metadata: {},
      fallbackItems: [{ name: "Burger", quantity: 1 }],
      adminBaseUrl: "https://app.meetsimon.ai",
    });

    expect(payload.adminUrl).toBe("https://app.meetsimon.ai/ocean-park/admin/orders");
  });

  it("formats slack message with admin url", () => {
    const payload = buildOrderCreatedAlertPayload({
      orderId: 125,
      orderStatus: "pending",
      hotel: { id: 1, name: "Ocean Park", slug: "ocean-park" },
      restaurant: { id: 2, name: "Test Restaurant" },
      guest: { name: "Chris", phone: null, email: null, roomNumber: "412" },
      totalAmount: "10.00",
      metadata: {},
      fallbackItems: [{ name: "Burger", quantity: 1 }],
      adminBaseUrl: "https://app.meetsimon.ai",
    });

    const message = formatOrderCreatedSlackMessage(payload);
    expect(message).toContain("Admin:");
    expect(message).toContain("https://app.meetsimon.ai/ocean-park/admin/orders");
  });
});

