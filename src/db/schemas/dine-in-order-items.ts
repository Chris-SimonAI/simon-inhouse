import { pgTable, bigserial, bigint, varchar, text, integer, numeric, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dineInOrders } from './dine-in-orders';
import { menuItems } from './menu-items';

export const dineInOrderItems = pgTable('dine_in_order_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => dineInOrders.id),
  menuItemId: bigint('menu_item_id', { mode: 'number' }).notNull().references(() => menuItems.id),
  menuItemGuid: uuid('menu_item_guid').notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  itemDescription: text('item_description'),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  modifierPrice: numeric('modifier_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  modifierDetails: jsonb('modifier_details'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DineInOrderItem = typeof dineInOrderItems.$inferSelect;
export type NewDineInOrderItem = typeof dineInOrderItems.$inferInsert;
