import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { qrCodes } from "@/db/schemas/qrCodes";

const codeValidation = (schema: z.ZodString) =>
  schema.min(1, "QR code is required").max(255, "QR code too long");

const hotelIdValidation = (schema: z.ZodNumber) =>
    schema.min(1, "Hotel ID is required");

const isValidValidation = (schema: z.ZodBoolean) =>
    schema.default(true);

const expiresAtValidation = (schema: z.ZodDate) =>
    schema.default(new Date());

export const insertQrCodeSchema = createInsertSchema(qrCodes, {
  code: codeValidation,
  hotelId: hotelIdValidation,
  isValid: isValidValidation,
  expiresAt: expiresAtValidation,
});

export const updateQrCodeSchema = createUpdateSchema(qrCodes, {
  code: (schema) => codeValidation(schema).optional(),
  hotelId: (schema) => hotelIdValidation(schema).optional(),
  isValid: (schema) => isValidValidation(schema).optional(),
  expiresAt: (schema) => expiresAtValidation(schema).optional(),
});

export const selectQrCodeSchema = createSelectSchema(qrCodes);

export const selectQrCodeIdSchema = z.object({
  id: z.string(),
});

export const selectQrCodeInputSchema = z.object({
    code: z.string(),  // or z.string().nonempty()
  });

export const QRRevokeSchema = z.object({
    qrCode: z.string().optional(),
  }).refine(data => data.qrCode, {
    message: "QR code must be provided",
  });

export type InsertQrCode = z.infer<typeof insertQrCodeSchema>;
export type SelectQrCode = z.infer<typeof selectQrCodeSchema>;
export type UpdateQrCode = z.infer<typeof updateQrCodeSchema>;      
export type SelectQrCodeInput = z.infer<typeof selectQrCodeInputSchema>;
export type QRRevoke = z.infer<typeof QRRevokeSchema>;