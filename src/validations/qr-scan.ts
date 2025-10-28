import { z } from "zod";

export const QRScanSchema = z.object({
    qrCode: z.string().min(1, "QR code is required"),
  });

export type QRScan = z.infer<typeof QRScanSchema>;