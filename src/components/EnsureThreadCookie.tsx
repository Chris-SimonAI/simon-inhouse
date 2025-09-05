// TODO: this file is temporary and will be removed we plan cookies via better-auth

'use client';

import { useEffect } from 'react';
import { setThreadIdCookie } from '@/actions/thread';

export default function EnsureThreadCookie({
  threadId,
  hasCookie,
}: {
  threadId: string;
  hasCookie: boolean;
}) {
  useEffect(() => {
    if (!hasCookie) {
      // Server Action call — allowed to mutate cookies
      setThreadIdCookie(threadId);
    }
  }, [hasCookie, threadId]);

  return null;
}
