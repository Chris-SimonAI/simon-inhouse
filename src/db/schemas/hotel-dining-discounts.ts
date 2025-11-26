import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { hotels } from "./hotels";

export const discountStatusEnum = pgEnum("discount_status", [
  "requested",
  "redeemed",
]);

export const hotelDiningDiscounts = pgTable(
  "hotel_dining_discounts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    hotelId: bigint("hotel_id", { mode: "number" })
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    status: discountStatusEnum("status").notNull().default("requested"),
    ...timestamps,
  },
  (table) => [uniqueIndex("hotel_user_discount_idx").on(table.hotelId, table.userId)]
);

export type HotelDiningDiscount = typeof hotelDiningDiscounts.$inferSelect;
export type NewHotelDiningDiscount = typeof hotelDiningDiscounts.$inferInsert;

