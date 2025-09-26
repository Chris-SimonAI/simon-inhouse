import { pgTable, text, timestamp, boolean, bigserial, bigint, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { hotels } from "./hotels";
import { relations } from "drizzle-orm";

export const qrCodes = pgTable("qr_codes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull().references(() => hotels.id),
  isValid: boolean("is_valid").notNull().default(true),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  ...timestamps,
}, (table) => [
  index("qr_codes_hotel_id_index").on(table.hotelId)
]);

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  hotel: one(hotels, {
    fields: [qrCodes.hotelId],
    references: [hotels.id],
  }),
}));

export type QrCode = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;