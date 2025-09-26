"use server";

import { db, session } from "@/db";
import { auth } from "@/lib/auth";
import { SessionData } from "@/lib/sessions";
import { createError, createSuccess } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export interface UpdateSessionData {
  id?: string;
  hotelId?: string;
  qrId?: string;
  threadId?: string;
  qrCode?: string;
  token?: string;
}

export interface HotelSessionResult {
  ok: boolean;
  data?: {
    sessionId: string;
    userId: string;
    qrData: {
      hotelId: string;
      qrId: string;
      threadId: string;
      qrCode: string;
    };
  };
  message?: string;
}

export interface SessionDataResponse {
  sessionId: string;
  userId: string;
  qrData: {
    hotelId: string;
    qrId: string;
    threadId: string;
    qrCode: string;
  };
}

/**
 * Get the current hotel session with QR data
 * This is a server action for client boot hydration
 */
export async function getHotelSession(): Promise<CreateSuccess<SessionDataResponse> | CreateError<string[]>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
      query: {
        disableCookieCache: true
      }
    });

    if (!session) {
      return createError("No active session found");
    }

    // Get QR data from session additional fields
    const qrData = {
      hotelId: session.session.hotelId || '',
      qrId: session.session.qrId || '',
      threadId: session.session.threadId || '',
      qrCode: session.session.qrCode || '',
    };

    // Check if all required data is present
    if (!qrData.hotelId || !qrData.qrId || !qrData.threadId) {
      return createError("Incomplete QR session data");
    }

    const data: SessionDataResponse = {
      sessionId: session.session.id,
      userId: session.session.userId,
      qrData,
    };

    return createSuccess(data, "Hotel session retrieved successfully"); 

  } catch (error) {
    console.error("Get hotel session error:", error);
    return createError("Failed to get session data", error);
  }
}

export async function updateSession(data: Partial<Pick<UpdateSessionData, 'hotelId' | 'qrId' | 'threadId' | 'qrCode' | 'token'>>): Promise<CreateSuccess<SessionData> | CreateError<string[]>> {  
  try {
    // Validate that token is provided
    if (!data.token) {
      return createError("Token is required for session update");
    }

    // Update the session in the database
    const result = await db.update(session)
      .set({
        hotelId: data.hotelId,
        qrId: data.qrId,
        threadId: data.threadId,
        qrCode: data.qrCode,
        updatedAt: new Date(),
      })
      .where(eq(session.token, data.token))
      .returning();

    if (result.length === 0) {
      return createError("Session not found or update failed");
    }

    const updatedSession = result[0];
    // Return the session data in the expected format
    const sessionData: SessionData = {
      id: updatedSession.id,
      userId: updatedSession.userId,
      hotelId: updatedSession.hotelId || '',
      qrId: updatedSession.qrId || '',
      threadId: updatedSession.threadId || '',
      qrCode: updatedSession.qrCode || '',
      expiresAt: updatedSession.expiresAt,
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt,
      ipAddress: updatedSession.ipAddress || undefined,
      userAgent: updatedSession.userAgent || undefined,
    };

    return createSuccess(sessionData, "Session updated successfully");
  } catch (error) {
    console.error("Update session error:", error);
    return createError("Failed to update session", error);
  }
}

export async function deleteSessionsByQrCode(qrCode: string): Promise<CreateSuccess<number> | CreateError<string[]>> {
  try {
    const result = await db.delete(session).where(eq(session.qrCode, qrCode)).returning();
    const deletedCount = result.length || 0;
    return createSuccess(deletedCount, `Deleted ${deletedCount} sessions`);
  } catch (error) {
    console.error("Error deleting sessions by QR Code:", error);
    return createError("Failed to delete sessions", error);
  }
}