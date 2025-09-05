'use server';

import 'server-only';
import { createStreamableValue } from '@ai-sdk/rsc';
import { streamAgent, type ConciergeStreamEvent } from '@/lib/agent';

export type ExtraData = {
  inputType?: 'voice' | 'text';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  data?: unknown;
};

export type ChatRequestOptions = ExtraData

export type RscServerAction = (args: {
  message: string;
  threadId: string;
  extra?: ExtraData;
}) => Promise<{ stream: unknown }>;

export async function processChatMessageStream(args: {
  message: string;
  threadId: string;
  extra?: ExtraData;
}) {
  const stream = createStreamableValue<ConciergeStreamEvent | null>(null);

  (async () => {
    try {
      const { message, threadId, extra = {} } = args;
      const inputType = extra.inputType || 'text';

      for await (const evt of streamAgent({
        message,
        threadId,
        tags: ['chat'],
        metadata: { surface: 'concierge', inputType },
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
