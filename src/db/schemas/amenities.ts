import { relations } from "drizzle-orm";
import { hotels } from "./hotels";
import { pgTable, bigserial, bigint, varchar, text, jsonb, index, vector } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";


export const amenities = pgTable("amenities", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  hotelId: bigint("hotel_id", { mode: "number" }).notNull().references(() => hotels.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  imageUrls: text("image_urls").array().$type<string[]>().default([]),
  tags: varchar("tags", { length: 255 }).array().$type<string[]>(),
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => [
  index("amenities_hotel_id_index").on(table.hotelId),
  index("amenities_embedding_idx")
  .using("ivfflat", table.embedding.op("vector_cosine_ops"))
  .with({ lists: 100 }),
]);

// Relations
export const amenitiesRelations = relations(amenities, ({ one }) => ({
  hotel: one(hotels, {
    fields: [amenities.hotelId],
    references: [hotels.id],
  }),
}));

export type Amenity = typeof amenities.$inferSelect;
export type NewAmenity = typeof amenities.$inferInsert;
