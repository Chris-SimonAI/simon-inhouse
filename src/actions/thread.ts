// TODO: this file is temporary and will be removed we plan cookies via better-auth
'use server';

import { cookies } from 'next/headers';
import 'server-only';

const THREAD_COOKIE_NAME = 'simon-thread-id';
const THREAD_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function readThreadId(): Promise<string | null> {
  const cookieStore = await cookies(); // keep await if you're on the async API
  return cookieStore.get(THREAD_COOKIE_NAME)?.value ?? null;
}

export async function setThreadIdCookie(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(THREAD_COOKIE_NAME, id, {
    maxAge: THREAD_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
