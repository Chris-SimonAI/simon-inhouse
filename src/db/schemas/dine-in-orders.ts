import { pgTable, bigserial, bigint, varchar, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { hotels } from './hotels';
import { dineInRestaurants } from './dine-in-restaurants';
import { user } from './auth';

export const orderStatusEnum = pgEnum('order_status', [
  'pending', 
  'confirmed', 
  'delivered', 
  'cancelled', 
  'failed',
  'requested_to_toast',
  'toast_ordered', 
  'toast_ok_capture_failed'
]);

export const dineInOrders = pgTable('dine_in_orders', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  hotelId: bigint('hotel_id', { mode: 'number' }).notNull().references(() => hotels.id),
  restaurantId: bigint('restaurant_id', { mode: 'number' }).notNull().references(() => dineInRestaurants.id),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' }),
  roomNumber: varchar('room_number', { length: 10 }).notNull(),
  specialInstructions: text('special_instructions'),
  totalAmount: varchar('total_amount', { length: 20 }).notNull(), // Store as string to avoid precision issues
  orderStatus: orderStatusEnum('order_status').notNull().default('pending'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DineInOrder = typeof dineInOrders.$inferSelect;
export type NewDineInOrder = typeof dineInOrders.$inferInsert;

