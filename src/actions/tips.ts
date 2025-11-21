'use server';

import 'server-only';
import { db } from '@/db';
import { tips } from '@/db/schemas';
import { eq, desc } from 'drizzle-orm';
import { 
  CreateTipRequestSchema, 
  UpdateTipStatusSchema,
  type CreateTipRequest,
  type UpdateTipStatusRequest,
} from '@/validations/tips';
import { type Tip } from '@/db/schemas/tips';
import { CreateSuccess, CreateError } from '@/types/response';
import { createSuccess, createError } from '@/lib/utils';
import { z } from 'zod';
import { stripe as stripeServer } from '@/lib/stripe';

// Create a new tip
export async function createTip(
  input: CreateTipRequest
): Promise<CreateSuccess<Tip> | CreateError<string[]>> {
  try {
    const validatedInput = CreateTipRequestSchema.parse(input);

    const newTip = await db
      .insert(tips)
      .values({
        hotelId: validatedInput.hotelId,
        amount: validatedInput.amount,
        currency: validatedInput.currency,
        paymentMethod: validatedInput.paymentMethod,
        paymentStatus: 'pending',
        guestName: validatedInput.guestName,
        guestEmail: validatedInput.guestEmail,
        roomNumber: validatedInput.roomNumber,
        message: validatedInput.message,
      })
      .returning();

    return createSuccess(newTip[0]);
  } catch (error) {
    console.error('Error creating tip:', error);
    return createError(
      error instanceof Error ? error.message : 'Failed to create tip'
    );
  }
}

// --- Stripe Tip Payments ---

const CreateTipPaymentIntentSchema = z.object({
  tipId: z.number().int().positive(),
});

export async function createTipPaymentIntent(
  input: unknown
): Promise<CreateSuccess<{ clientSecret: string | null; paymentIntentId: string }> | CreateError> {
  try {
    const { tipId } = CreateTipPaymentIntentSchema.parse(input);

    const tipResult = await getTipById(tipId);
    if (!tipResult.ok || !tipResult.data) {
      return createError('Tip not found');
    }

    const tip = tipResult.data;
    if (tip.paymentStatus !== 'pending') {
      return createError('Tip is not in a pending state');
    }

    const amountNumber = Number.parseFloat(String(tip.amount));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return createError('Invalid tip amount');
    }

    const pi = await stripeServer.paymentIntents.create({
      amount: Math.round(amountNumber * 100),
      currency: (tip.currency || 'usd').toLowerCase(),
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      capture_method: 'automatic',
      metadata: {
        tipId: String(tip.id),
        hotelId: String(tip.hotelId),
        type: 'tip',
      },
    });

    return createSuccess({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    });
  } catch (error) {
    console.error('Error creating tip payment intent:', error);
    return createError('Failed to create tip payment intent');
  }
}

const ConfirmTipPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  paymentMethodId: z.string().min(1),
});

export async function confirmTipPayment(
  input: unknown
): Promise<CreateSuccess<{ paymentIntentId: string; status: string }> | CreateError> {
  try {
    const { paymentIntentId, paymentMethodId } = ConfirmTipPaymentSchema.parse(input);

    const confirmed = await stripeServer.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    return createSuccess({
      paymentIntentId: confirmed.id,
      status: confirmed.status,
    });
  } catch (error) {
    console.error('Error confirming tip payment:', error);
    return createError('Failed to confirm tip payment');
  }
}

// Update tip status
export async function updateTipStatus(
  input: UpdateTipStatusRequest
): Promise<CreateSuccess<Tip> | CreateError<string[]>> {
  try {
    const validatedInput = UpdateTipStatusSchema.parse(input);

    const updatedTip = await db
      .update(tips)
      .set({
        paymentStatus: validatedInput.status,
        transactionId: validatedInput.transactionId,
      })
      .where(eq(tips.id, validatedInput.tipId))
      .returning();

    if (updatedTip.length === 0) {
      return createError('Tip not found');
    }

    return createSuccess(updatedTip[0]);
  } catch (error) {
    console.error('Error updating tip status:', error);
    return createError(
      error instanceof Error ? error.message : 'Failed to update tip status'
    );
  }
}

// Get tip by ID
export async function getTipById(
  tipId: number
): Promise<CreateSuccess<Tip> | CreateError<string[]>> {
  try {
    const tip = await db
      .select()
      .from(tips)
      .where(eq(tips.id, tipId))
      .limit(1);

    if (tip.length === 0) {
      return createError('Tip not found');
    }

    return createSuccess(tip[0]);
  } catch (error) {
    console.error('Error fetching tip by ID:', error);
    return createError(
      error instanceof Error ? error.message : 'Failed to fetch tip'
    );
  }
}

// Get recent tips for hotel
export async function getRecentTips(
  hotelId: number,
  limit: number = 10
): Promise<CreateSuccess<Tip[]> | CreateError<string[]>> {
  try {
    const recentTips = await db
      .select()
      .from(tips)
      .where(eq(tips.hotelId, hotelId))
      .orderBy(desc(tips.createdAt))
      .limit(limit);

    return createSuccess(recentTips);
  } catch (error) {
    console.error('Error fetching recent tips:', error);
    return createError(
      error instanceof Error ? error.message : 'Failed to fetch recent tips'
    );
  }
}
