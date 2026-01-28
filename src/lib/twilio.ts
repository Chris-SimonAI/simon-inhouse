import 'server-only';
import { db } from '@/db';
import { appSettings } from '@/db/schemas';
import { inArray } from 'drizzle-orm';
import { env } from '@/env';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  enabled: boolean;
}

const TWILIO_KEYS = [
  'twilio_account_sid',
  'twilio_auth_token',
  'twilio_phone_number',
] as const;

/**
 * Reads Twilio config from app_settings DB first, falling back to env vars.
 * Same pattern as get-payment-info.ts.
 */
async function getTwilioConfig(): Promise<TwilioConfig> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...TWILIO_KEYS]));

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  const accountSid = settings.twilio_account_sid || env.TWILIO_ACCOUNT_SID || '';
  const authToken = settings.twilio_auth_token || env.TWILIO_AUTH_TOKEN || '';

  return {
    accountSid,
    authToken,
    enabled: !!(accountSid && authToken),
  };
}

/**
 * Get the Twilio phone number to use on Toast checkout.
 * Reads from app_settings DB first, then falls back to env var.
 * Returns null if not configured.
 */
export async function getTwilioPhoneNumber(): Promise<string | null> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...TWILIO_KEYS]));

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return settings.twilio_phone_number || env.TWILIO_PHONE_NUMBER || null;
}

interface SendSMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Send an SMS via Twilio. Never throws — returns success/error result.
 */
export async function sendSMS(to: string, from: string, body: string): Promise<SendSMSResult> {
  const config = await getTwilioConfig();

  if (!config.enabled) {
    console.log('[Twilio] SMS disabled (no credentials). Would send:');
    console.log(`  To: ${to}`);
    console.log(`  From: ${from}`);
    console.log(`  Body: ${body}`);
    return { success: true, messageSid: 'dry-run' };
  }

  try {
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);

    const message = await client.messages.create({ to, from, body });

    console.log(`[Twilio] SMS sent: ${message.sid}`);
    return { success: true, messageSid: message.sid };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Failed to send SMS:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Check if Twilio is configured (has account SID + auth token).
 */
export async function isTwilioEnabled(): Promise<boolean> {
  const config = await getTwilioConfig();
  return config.enabled;
}
