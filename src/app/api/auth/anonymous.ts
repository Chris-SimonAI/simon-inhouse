import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHotelBySlug } from "@/actions/hotels";
import { initialiseSessionForHotel } from "@/actions/sessions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const slug = url.searchParams.get("slug");
  const redirectTo = url.searchParams.get("redirect") ?? "/";

  if (!slug) {
    return NextResponse.redirect(new URL("/hotel-not-found", url));
  }

  const hotelResult = await getHotelBySlug(slug);
  if (!hotelResult.ok || !hotelResult.data) {
    return NextResponse.redirect(new URL("/hotel-not-found", url));
  }

  const authResponse = await auth.api.signInAnonymous({
    asResponse: true,
    headers: request.headers,
  });

  const cloned = authResponse.clone();
  let token: string | undefined;
  try {
    const payload = await cloned.json();
    token = payload?.token;
  } catch (_error) {
    // ignore JSON parsing issues and handle below
  }

  if (!token) {
    return NextResponse.redirect(new URL("/hotel-not-found", url));
  }

  const initialiseResult = await initialiseSessionForHotel(
    hotelResult.data.id,
    token,
  );

  if (!initialiseResult.ok || !initialiseResult.data) {
    return NextResponse.redirect(new URL("/hotel-not-found", url));
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL as string;
  
  const redirectUrl = new URL(redirectTo, baseUrl);

  const redirectResponse = NextResponse.redirect(redirectUrl);

  const setCookies = authResponse.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    redirectResponse.headers.append("Set-Cookie", cookie);
  }

  return redirectResponse;
}
