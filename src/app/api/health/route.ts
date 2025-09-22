import { NextResponse } from 'next/server';

export const runtime = "nodejs";

export async function GET() {
  try {
    // Basic health check - just return OK
    // In a more complex setup, you might check database connectivity, etc.
    return NextResponse.json(
      { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'meet-simon'
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
