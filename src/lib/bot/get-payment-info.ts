import 'server-only';
import { db } from '@/db';
import { appSettings } from '@/db/schemas';
import { inArray } from 'drizzle-orm';
import { env } from '@/env';

export interface PaymentInfo {
  cardNumber: string;
  expiry: string;
  cvv: string;
  zip: string;
}

const SETTING_KEYS = [
  'bot_card_number',
  'bot_card_expiry',
  'bot_card_cvv',
  'bot_card_zip',
] as const;

/**
 * Reads payment card info from the app_settings table,
 * falling back to environment variables if not set in DB.
 */
export async function getPaymentInfo(): Promise<PaymentInfo> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...SETTING_KEYS]));

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return {
    cardNumber: settings.bot_card_number || env.BOT_CARD_NUMBER || '',
    expiry: settings.bot_card_expiry || env.BOT_CARD_EXPIRY || '',
    cvv: settings.bot_card_cvv || env.BOT_CARD_CVV || '',
    zip: settings.bot_card_zip || env.BOT_CARD_ZIP || '',
  };
}
