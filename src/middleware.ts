import { NextResponse } from "next/server";

// Middleware runs before every request
export function middleware(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  /**
   * Public routes that don't require a session
   */
  const publicRoutes = [
    "/qr-code",            
    "/hotel-not-found",     
    "/not-found",   
    "/_next",               // internal Next.js assets
    "/api",                 // API routes handle their own auth
    "/favicon.ico",         // favicon
    "/assets",              // static files if any
  ];

  const isPublic = publicRoutes.some((path) => pathname.startsWith(path));

  /**
   * Check for presence of the Better Auth session cookie
   * (set by /api/auth/qr-scan)
   */
  const hasSession =
    req.headers.get("cookie")?.includes("better-auth.session_token");

  // 🚫 Redirect users without session trying to access protected pages
  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/hotel-not-found", req.url));
  }

  return NextResponse.next();
}

/**
 * Match all routes except static files (images, JS, CSS) for middleware execution
 */
export const config = {
  matcher: [
    /*
      Apply middleware to all routes except:
      - /_next (Next.js internals)
      - /api (API endpoints)
      - /favicon.ico, /assets/* (static)
    */
    "/((?!_next/static|_next/image|favicon.ico|api|assets).*)",
  ],
};
