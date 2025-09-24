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

export type ActionResult<T> = {
  ok: boolean;
  data?: T;
  message?: string;
};

// Create a new tip
export async function createTip(
  input: CreateTipRequest
): Promise<ActionResult<Tip>> {
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

    return {
      ok: true,
      data: newTip[0],
    };
  } catch (error) {
    console.error('Error creating tip:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to create tip',
    };
  }
}

// Update tip status
export async function updateTipStatus(
  input: UpdateTipStatusRequest
): Promise<ActionResult<Tip>> {
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
      return {
        ok: false,
        message: 'Tip not found',
      };
    }

    return {
      ok: true,
      data: updatedTip[0],
    };
  } catch (error) {
    console.error('Error updating tip status:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update tip status',
    };
  }
}

// Get tip by ID
export async function getTipById(
  tipId: number
): Promise<ActionResult<Tip>> {
  try {
    const tip = await db
      .select()
      .from(tips)
      .where(eq(tips.id, tipId))
      .limit(1);

    if (tip.length === 0) {
      return {
        ok: false,
        message: 'Tip not found',
      };
    }

    return {
      ok: true,
      data: tip[0],
    };
  } catch (error) {
    console.error('Error fetching tip by ID:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to fetch tip',
    };
  }
}

// Get recent tips for hotel
export async function getRecentTips(
  hotelId: number,
  limit: number = 10
): Promise<ActionResult<Tip[]>> {
  try {
    const recentTips = await db
      .select()
      .from(tips)
      .where(eq(tips.hotelId, hotelId))
      .orderBy(desc(tips.createdAt))
      .limit(limit);

    return {
      ok: true,
      data: recentTips,
    };
  } catch (error) {
    console.error('Error fetching recent tips:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to fetch recent tips',
    };
  }
}
