'use server';

import 'server-only';

import { z } from 'zod';
import { createError, createSuccess } from '@/lib/utils';
import { deepScanOrderingLinks } from '@/lib/restaurant-discovery/ordering-link-deep-scan';
import { type OrderingLinkDeepScanResult } from '@/lib/restaurant-discovery/restaurant-discovery-types';

const deepScanSchema = z.object({
  websiteUrl: z.string().url(),
  maxCandidates: z.number().int().min(1).max(10).default(5),
  timeoutMs: z.number().int().min(10_000).max(120_000).optional(),
});

export async function runOrderingLinkDeepScan(input: unknown) {
  const parsed = deepScanSchema.safeParse(input);
  if (!parsed.success) {
    return createError('Invalid deep scan request', parsed.error.flatten());
  }

  const request = parsed.data;

  try {
    const data: OrderingLinkDeepScanResult = await deepScanOrderingLinks({
      websiteUrl: request.websiteUrl,
      maxCandidates: request.maxCandidates,
      timeoutMs: request.timeoutMs,
    });
    return createSuccess(data);
  } catch (error) {
    console.error('Error in runOrderingLinkDeepScan:', error);
    return createError('Deep scan failed');
  }
}
