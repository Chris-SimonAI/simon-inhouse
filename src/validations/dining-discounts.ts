import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { hotelDiningDiscounts } from "@/db/schemas";

// Dining discounts validation schemas
export const DiningDiscountSelectSchema = createSelectSchema(hotelDiningDiscounts);
export const DiningDiscountInsertSchema = createInsertSchema(hotelDiningDiscounts);

// Database types - inferred from Drizzle schemas
export type DiningDiscountSelect = typeof DiningDiscountSelectSchema._type;
export type DiningDiscountInsert = typeof DiningDiscountInsertSchema._type;

