import { pgTable, bigserial, bigint, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { dineInOrders } from './dine-in-orders';

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'processing', 'succeeded', 'failed', 'cancelled']);

export const dineInPayments = pgTable('dine_in_payments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => dineInOrders.id),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).notNull(),
  amount: varchar('amount', { length: 20 }).notNull(), // Store as string to avoid precision issues
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
  stripeMetadata: jsonb('stripe_metadata'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DineInPayment = typeof dineInPayments.$inferSelect;
export type NewDineInPayment = typeof dineInPayments.$inferInsert;
