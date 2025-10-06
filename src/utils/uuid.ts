import { randomUUID } from "crypto";

/**
 * Generate a UUID v4 string
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Generate a short UUID for QR codes (8 characters)
 */
export function generateShortUUID(): string {
  return randomUUID().replace(/-/g, "").substring(0, 8);
}