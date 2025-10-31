import { z } from 'zod';

// Price validation - allows 0, 1, or 2 decimal places
const priceSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid number (e.g., 0, 12.99)');

// Modifier details schema
const modifierOptionSchema = z.object({
  optionId: z.string().uuid(),
  optionName: z.string().min(1),
  optionPrice: priceSchema,
});

const modifierGroupSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string().min(1),
  options: z.array(modifierOptionSchema),
});

const modifierDetailsSchema = z.array(modifierGroupSchema);

// Order item schema
const orderItemSchema = z.object({
  menuItemId: z.number().int().min(0), // Allow 0 initially, will be set after UUID lookup
  menuItemGuid: z.string().uuid(),
  itemName: z.string().min(1),
  itemDescription: z.string().optional(),
  basePrice: priceSchema,
  modifierPrice: priceSchema,
  unitPrice: priceSchema,
  quantity: z.number().int().positive(),
  modifierDetails: modifierDetailsSchema.optional(),
});

// Create order request schema
export const CreateOrderRequestSchema = z.object({
  hotelId: z.number().int().positive(),
  restaurantId: z.number().int().positive(),
  userId: z.number().int().positive(),
  roomNumber: z.string().min(1).max(10),
  specialInstructions: z.string().optional(),
  email: z.string().email({ message: 'Valid email is required' }),
  phoneNumber: z.string().min(7, { message: 'Phone number is required' }).max(20),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
});

// Update order status request schema
export const UpdateOrderStatusRequestSchema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum([
    'pending', 
    'confirmed', 
    'delivered', 
    'cancelled', 
    'failed',
    'requested_to_toast',
    'toast_ordered', 
    'toast_ok_capture_failed'
  ]),
});

// Create payment request schema
export const CreatePaymentRequestSchema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('usd'),
});

// Update payment status request schema
export const UpdatePaymentStatusRequestSchema = z.object({
  paymentId: z.number().int().positive(),
  status: z.enum(['pending', 'processing', 'authorized', 'succeeded', 'failed', 'cancelled']),
});

// Create payment intent request schema
export const CreatePaymentIntentSchema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive(),
});

// Confirm payment request schema
export const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
});

// Type exports
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type UpdateOrderStatusRequest = z.infer<typeof UpdateOrderStatusRequestSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type UpdatePaymentStatusRequest = z.infer<typeof UpdatePaymentStatusRequestSchema>;
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentSchema>;
export type ConfirmPaymentRequest = z.infer<typeof ConfirmPaymentSchema>;
export type ModifierDetails = z.infer<typeof modifierDetailsSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
