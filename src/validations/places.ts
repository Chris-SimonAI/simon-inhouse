import { z } from 'zod';

export const SearchPlacesArgsSchema = z.object({
  query: z.string().min(1).optional().default("restaurants"),
  radiusKm: z.number().min(0.1).max(15).optional().default(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openNow: z.boolean().optional().default(true),
  maxResults: z.number().int().min(1).max(5).optional().default(5),
  detailsLimit: z.number().int().min(1).max(5).optional().default(5),
});

export type SearchPlacesArgsInput = z.infer<typeof SearchPlacesArgsSchema>;
