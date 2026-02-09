import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    sha:
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.RAILWAY_GIT_COMMIT ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      null,
    now: new Date().toISOString(),
  });
}

