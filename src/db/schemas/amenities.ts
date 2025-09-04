import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { hotels } from "./hotels";

export const amenities = pgTable("amenities", {
  id: uuid("id").defaultRandom().primaryKey(),
  hotelId: uuid("hotel_id").notNull().references(() => hotels.id),

  roomTypes: jsonb("room_types"),
  diningOptions: jsonb("dining_options"),
  poolOptions: jsonb("pool_options"),
  spaServices: jsonb("spa_services"),
  fitnessCenters: jsonb("fitness_centers"),
  businessCenters: jsonb("business_centers"),
  meetingSpaces: jsonb("meeting_spaces"),
  accessibilityFeatures: jsonb("accessibility_features"),
  entertainment: jsonb("entertainment"),
  kidsFacilities: jsonb("kids_facilities"),
  outdoorActivities: jsonb("outdoor_activities"),
  transportServices: jsonb("transport_services"),
  retailShops: jsonb("retail_shops"),
  laundryServices: jsonb("laundry_services"),
  conciergeServices: jsonb("concierge_services"),
  roomServices: jsonb("room_services"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Relations
export const amenitiesRelations = relations(amenities, ({ one }) => ({
  hotel: one(hotels, {
    fields: [amenities.hotelId],
    references: [hotels.id],
  }),
}));

export type Amenities = typeof amenities.$inferSelect;
export type NewAmenities = typeof amenities.$inferInsert;