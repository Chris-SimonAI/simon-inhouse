import { auth } from "@/lib/auth";
import { updateSession } from "@/actions/sessions";

export interface SessionData {
  id: string;
  userId: string;
  hotelId: string;
  qrId: string;
  threadId: string;
  qrCode: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateSessionData {
  userId: string;
  hotelId: string;
  qrId: string;
  threadId: string;
  qrCode: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new session using Better Auth
 * @param data - The data for the session
 * @returns The session data
 */
export async function createSession(data: CreateSessionData): Promise<SessionData | null> {
  try {
    // Create a temporary user account
    const sessionData = {
      hotelId: data.hotelId,
      qrId: data.qrId,
      threadId: data.threadId,
      qrCode: data.qrCode,
      token: ''
    }
    const signInResult = await auth.api.signInAnonymous()
    console.log("Sign in success:", signInResult);
    if (!signInResult || !signInResult.token) {
      return null;  
    }

    sessionData.token = signInResult.token;
    const updateSessionResult = await updateSession(sessionData);

    if (!updateSessionResult.ok || !updateSessionResult.data) {
      console.error("Failed to update session:", updateSessionResult);
      return null;
    }

    return updateSessionResult.data;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}
