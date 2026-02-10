import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function pickWafHeaders(headers: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower === "server" ||
      lower.startsWith("cf-") ||
      lower.includes("cloudflare") ||
      lower === "via" ||
      lower === "x-cache" ||
      lower.startsWith("x-amz-cf-") ||
      lower.startsWith("x-akamai-") ||
      lower.startsWith("x-sucuri-") ||
      lower.startsWith("x-request-id")
    ) {
      out[lower] = value;
    }
  }
  return out;
}

