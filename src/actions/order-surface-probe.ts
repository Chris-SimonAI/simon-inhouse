'use server';

import 'server-only';

import { z } from 'zod';
import { createError, createSuccess } from '@/lib/utils';
import {
  probeOrderSurface,
  type OrderSurfaceProbeResult,
} from '@/lib/restaurant-discovery/order-surface-prober';

const orderSurfaceProbeSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().min(10_000).max(120_000).optional(),
});

export async function runOrderSurfaceProbe(input: unknown) {
  const parsed = orderSurfaceProbeSchema.safeParse(input);
  if (!parsed.success) {
    return createError('Invalid probe request', parsed.error.flatten());
  }

  const request = parsed.data;

  try {
    const data: OrderSurfaceProbeResult = await probeOrderSurface({
      url: request.url,
      timeoutMs: request.timeoutMs,
    });
    return createSuccess(data);
  } catch (error) {
    console.error('Error in runOrderSurfaceProbe:', error);
    return createError('Probe failed');
  }
}

