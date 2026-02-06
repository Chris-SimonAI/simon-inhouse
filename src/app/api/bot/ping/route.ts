import { NextResponse } from "next/server";
import { env } from "@/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    hasPlaywright: false,
    proxyConfigured: !!env.SCRAPER_PROXY_URL,
  });
}

export async function POST() {
  // Test Playwright import
  try {
    const { chromium } = await import("playwright");
    return NextResponse.json({
      ok: true,
      playwrightLoaded: true,
      chromiumAvailable: !!chromium,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      playwrightLoaded: false,
      error: message,
    }, { status: 500 });
  }
}
