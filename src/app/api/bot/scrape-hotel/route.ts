import { NextRequest, NextResponse } from "next/server";
import { scrapeHotel } from "@/lib/bot/hotel-scraper";
import { createError, createSuccess } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        createError("url is required"),
        { status: 400 }
      );
    }

    console.log(`[scrape-hotel] Starting scrape for ${url}...`);
    const result = await scrapeHotel(url);
    console.log(`[scrape-hotel] Scraped: ${result.name} at ${result.address}`);

    return NextResponse.json(createSuccess(result));
  } catch (error) {
    console.error("Error in POST /api/bot/scrape-hotel:", error);
    const message = error instanceof Error ? error.message : "Failed to scrape hotel";
    return NextResponse.json(createError(message), { status: 500 });
  }
}
