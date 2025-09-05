import { relations } from "drizzle-orm";
import { hotels } from "./hotels";
import { pgTable, bigserial, bigint, varchar, text, jsonb } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";


export const amenities = pgTable("amenities", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrls: text("image_urls").array().$type<string[]>(),
  tags: varchar("tags", { length: 255 }).array().$type<string[]>(),
  metadata: jsonb("metadata"),
  ...timestamps,
});

// Relations
export const amenitiesRelations = relations(amenities, ({ one }) => ({
  hotel: one(hotels, {
    fields: [amenities.hotelId],
    references: [hotels.id],
  }),
}));

export type Amenity = typeof amenities.$inferSelect;
export type NewAmenity = typeof amenities.$inferInsert;