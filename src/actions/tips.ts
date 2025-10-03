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
