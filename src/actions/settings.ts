'use server';

import 'server-only';
import { db } from '@/db';
import { appSettings } from '@/db/schemas';
import { eq, inArray } from 'drizzle-orm';

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function upsertSettings(entries: { key: string; value: string }[]) {
  if (entries.length === 0) return;

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      const existing = await tx
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.key, entry.key))
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(appSettings)
          .set({ value: entry.value })
          .where(eq(appSettings.key, entry.key));
      } else {
        await tx.insert(appSettings).values({
          key: entry.key,
          value: entry.value,
        });
      }
    }
  });
}
