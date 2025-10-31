import { z } from "zod";

export const GetAmenitiesArgsSchema = z.object({
  hotelId: z.number().int().positive().describe("Hotel ID to fetch amenities for"),
  query: z.string().optional().describe("Optional query string for semantic search of specific amenities")
});

export type GetAmenitiesArgsInput = z.infer<typeof GetAmenitiesArgsSchema>;
