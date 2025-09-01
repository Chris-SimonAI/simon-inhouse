'use server';

import 'server-only';
import { createStreamableValue } from '@ai-sdk/rsc';
import { streamAgent, type ConciergeStreamEvent } from '@/lib/agent';
import { v4 as uuidv4 } from 'uuid';

export async function processChatMessageStream(
  args: { message: string; threadId?: string; extra?: { headers?: Record<string, string>; body?: Record<string, unknown>; data?: unknown } }
) {
  const stream = createStreamableValue<ConciergeStreamEvent | null>(null);

  (async () => {
    try {
      const { message, threadId = uuidv4() } = args;

      for await (const evt of streamAgent({
        message,
        threadId,
        tags: ['chat'],
        metadata: { surface: 'concierge' },
      })) {
        stream.update(evt);
      }

      stream.done(null);
} catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      stream.update({
        type: 'token',
        value: `Sorry, something went wrong: ${errorMessage}`,
        metadata: { agent: 'Concierge' },
      });
      stream.done(null);
    }
  })();

  return { stream: stream.value as unknown };
}
