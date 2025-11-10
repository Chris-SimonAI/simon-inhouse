"use server";

import { db, session } from "@/db";
import { auth } from "@/lib/auth";
import { createError, createSuccess } from "@/lib/utils";
import { CreateError, CreateSuccess } from "@/types/response";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { generateUUID } from "@/utils/uuid";

export interface SessionDataResponse {
  sessionId: string;
  userId: string;
  hotelId: number;
  threadId: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  hotelId: number;
  threadId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface UpdateSessionPayload {
  token: string;
  hotelId: number;
  threadId: string;
}

/**
 * Get the current Better Auth session (if any).
 */
export async function getHotelSession(): Promise<
  CreateSuccess<SessionDataResponse> | CreateError<string[]>
> {
  try {
    const currentSession = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });

    if (!currentSession) {
      return createError("No active session found");
    }

    const data: SessionDataResponse = {
      sessionId: currentSession.session.id,
      userId: currentSession.session.userId,
      hotelId: currentSession.session.hotelId,
      threadId: currentSession.session.threadId,
    };

    return createSuccess(data, "Session retrieved successfully");
  } catch (error) {
    console.error("Get hotel session error:", error);
    return createError("Failed to get session data", error);
  }
}

export async function updateSession(
  data: UpdateSessionPayload,
): Promise<CreateSuccess<SessionRecord> | CreateError<string[]>> {
  try {
    if (!data.token) {
      return createError("Token is required for session update");
    }

    const result = await db
      .update(session)
      .set({
        hotelId: data.hotelId,
        threadId: data.threadId,
        updatedAt: new Date(),
      })
      .where(eq(session.token, data.token))
      .returning();

    if (result.length === 0) {
      return createError("Session not found or update failed");
    }

    const updatedSession = result[0];

    if (!updatedSession.hotelId || !updatedSession.threadId) {
      return createError("Session missing hotel context after update");
    }

    const sessionData: SessionRecord = {
      id: updatedSession.id,
      userId: updatedSession.userId,
      hotelId: updatedSession.hotelId,
      threadId: updatedSession.threadId,
      expiresAt: updatedSession.expiresAt,
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt,
      ipAddress: updatedSession.ipAddress,
      userAgent: updatedSession.userAgent,
    };

    return createSuccess(sessionData, "Session updated successfully");
  } catch (error) {
    console.error("Update session error:", error);
    return createError("Failed to update session", error);
  }
}

export async function initialiseSessionForHotel(
  hotelId: number,
  token: string,
): Promise<CreateSuccess<SessionDataResponse> | CreateError<string[]>> {
  try {
    const threadId = generateUUID();
    const updateResult = await updateSession({
      hotelId,
      threadId,
      token,
    });

    if (!updateResult.ok || !updateResult.data) {
      return createError("Failed to initialise session for hotel");
    }

    return createSuccess({
      sessionId: updateResult.data.id,
      userId: updateResult.data.userId,
      hotelId: updateResult.data.hotelId,
      threadId: updateResult.data.threadId,
    });
  } catch (error) {
    console.error("Initialise session error:", error);
    return createError("Failed to initialise session for hotel", error);
  }
}

export async function ensureSessionForHotel(
  hotelId: number,
): Promise<CreateSuccess<SessionDataResponse> | CreateError<string[]>> {
  try {
    const currentSession = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });

    if (!currentSession) {
      return createError("No active session found");
    }

    const existingHotelId = currentSession.session.hotelId;
    const existingThreadId = currentSession.session.threadId;
    const existingToken = currentSession.session.token;

    if (!existingToken) {
      return createError("Session token missing for update");
    }

    if (existingHotelId === hotelId && existingThreadId) {
      return createSuccess({
        sessionId: currentSession.session.id,
        userId: currentSession.session.userId,
        hotelId: existingHotelId,
        threadId: existingThreadId,
      });
    }

    const threadId = generateUUID();
    const updateResult = await updateSession({
      hotelId,
      threadId,
      token: existingToken,
    });

    if (!updateResult.ok || !updateResult.data) {
      return createError("Failed to update session for hotel");
    }

    return createSuccess({
      sessionId: updateResult.data.id,
      userId: updateResult.data.userId,
      hotelId: updateResult.data.hotelId,
      threadId: updateResult.data.threadId,
    });
  } catch (error) {
    console.error("Ensure session for hotel error:", error);
    return createError("Failed to ensure session for hotel", error);
  }
}
