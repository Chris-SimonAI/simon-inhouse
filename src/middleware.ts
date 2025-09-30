import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Only guard the home page
  if (pathname === '/') {
    const hasPlayed = req.cookies.get('simon-intro-played')?.value === 'true';
    if (!hasPlayed) {
      const url = req.nextUrl.clone();
      url.pathname = '/welcome';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/welcome', '/welcome/voice'],
};
