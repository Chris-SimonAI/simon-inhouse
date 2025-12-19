import { z } from "zod";

const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const dayKeySchema = z.enum(dayKeys);

const time24hSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Expected HH:mm time string (24-hour)");

const businessHoursWindowSchema = z.object({
  open: time24hSchema,
  close: time24hSchema,
  isOvernight: z.boolean(),
});

const normalizedHoursSchema = z.object(
  Object.fromEntries(
    dayKeys.map((day) => [day, z.array(businessHoursWindowSchema).optional()]),
  ) as z.ZodRawShape,
);

export const businessHoursSchema = z.object({
  raw: z.record(z.string(), z.string()).optional(),
  version: z.number().optional(),
  normalized: normalizedHoursSchema.optional(),
});

export type BusinessHours = z.infer<typeof businessHoursSchema>;
export type BusinessHoursDayKey = z.infer<typeof dayKeySchema>;

