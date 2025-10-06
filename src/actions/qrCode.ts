'use server';

import { db, qrCodes } from "@/db";
import { generateShortUUID } from "@/utils/uuid";
import { insertQrCodeSchema, selectQrCodeInputSchema, selectQrCodeIdSchema } from "@/validations/qrCodes";
import { eq, isNull, and } from "drizzle-orm";
import { deleteSessionsByQrCode } from "@/actions/sessions"; 
import { createError, createSuccess } from "@/lib/utils";

// Create a new QR code
// curl -X POST http://localhost:3000/api/qr-code/create -H "x-api-key: 1234567890" -d '{"hotelId": 1}'
export const createQRCode = async (hotelId: number) => {
    try {
        const validatedInput = insertQrCodeSchema.parse({
            hotelId,
            code: generateShortUUID(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        });
        const [qrCode] = await db.insert(qrCodes).values(validatedInput).returning();
        return createSuccess(qrCode, "QR code created successfully");
    } catch (error) {
        console.error(error);   
        return createError("Failed to create QR code");
    }
};   


export const validateQRCode = async (code: string) => {
    try {
        const validatedInput = selectQrCodeInputSchema.parse({
            code: code,
        });
        const [qrCode] = await db.select().from(qrCodes).where(and(eq(qrCodes.code, validatedInput.code), eq(qrCodes.isValid, true), isNull(qrCodes.revokedAt)));     
        return createSuccess(qrCode, "QR code validated successfully");
        } catch (error) {
        console.error("error", error);
        return createError("Failed to validate QR code");
    }
};

export const revokeQRCode = async (qrId: string) => {
    try {
        const validatedInput = selectQrCodeIdSchema.parse({
            id: qrId,
        });
        const [qrCode] = await db.update(qrCodes).set({ revokedAt: new Date() }).where(eq(qrCodes.id, Number(validatedInput.id))).returning();
        return createSuccess(qrCode, "QR code revoked successfully");
    } catch (error) {
        console.error(error);
        return createError("Failed to revoke QR code");
    }
};

export const revokeQRCodeByCodeAndSessions = async (qrCode: string) => {
    try {
        // First get the QR code to find its ID
        const [qrCodeRecord] = await db
            .select()
            .from(qrCodes)
            .where(eq(qrCodes.code, qrCode))
            .limit(1);

        if (!qrCodeRecord) {
            return createError("QR code not found");
        }

        // Revoke the QR code
        const revokeResult = await revokeQRCode(qrCodeRecord.id.toString());
        if (!revokeResult?.ok || !revokeResult?.data) {
            return createError("Failed to revoke QR code");
        }

        // Delete all sessions associated with this QR code
        const deleteSessionsResult = await deleteSessionsByQrCode(qrCode);

        if (!deleteSessionsResult.ok) {
            return createError("Failed to delete sessions");
        }

        return createSuccess({
            qrCode: revokeResult.data,
            deletedSessionsCount: deleteSessionsResult.data,
        }, `QR code revoked and ${deleteSessionsResult.data} session(s) deleted`);
    } catch (error) {
        console.error(error);
        return createError("Failed to revoke QR code and sessions");
    }
};