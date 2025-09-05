'use server';

import 'server-only';
import { createStreamableValue } from '@ai-sdk/rsc';
import { streamAgent, type ConciergeStreamEvent } from '@/lib/agent';
import { getCheckpointer } from '@/lib/agent/checkpointer';
import {
  HumanMessage,
  AIMessage,
  AIMessageChunk,
  ToolMessage,
} from "@langchain/core/messages";
import type { UIMessage } from 'ai';

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

export async function getThreadMessages(threadId: string): Promise<UIMessage[]> {
  try {
    const config = { configurable: { thread_id: threadId } };
    const checkpointer = await getCheckpointer();
    const checkpoint = await checkpointer.get(config);

    if (!checkpoint?.channel_values?.messages) return [];

    const messages: UIMessage[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const langchainMessages = checkpoint.channel_values.messages as any[];

    const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Accumulate assistant parts across AI/TOOL until a human appears
    let accParts: UIMessage['parts'] = [];
    let accAgent: string | undefined;

    const flushAssistant = () => {
      if (accParts.length === 0) return;
      messages.push({
        id: `asst-${nowId()}`,
        role: 'assistant',
        parts: accParts,
        metadata: { agent: accAgent || 'assistant' },
      });
      accParts = [];
      accAgent = undefined;
    };

    for (let i = 0; i < langchainMessages.length; i++) {
      const msg = langchainMessages[i];
      if (msg?.name === 'transfer_to_discovery') continue;

      const isAI =
        msg instanceof AIMessage ||
        msg instanceof AIMessageChunk ||
        msg?.getType?.() === 'ai' ||
        msg?._getType?.() === 'ai' ||
        msg?.type === 'ai';

      const isHuman =
        msg instanceof HumanMessage ||
        msg?.getType?.() === 'human' ||
        msg?._getType?.() === 'human' ||
        msg?.type === 'human';

      const isTool =
        msg instanceof ToolMessage ||
        msg?.getType?.() === 'tool' ||
        msg?._getType?.() === 'tool' ||
        msg?.type === 'tool';

      // HUMAN: boundary — flush assistant, push user if non-empty
      if (isHuman) {
        flushAssistant();
        const text = String(msg.content ?? '');
        if (text.trim() !== '') {
          messages.push({
            id: `user-${nowId()}`,
            role: 'user',
            parts: [{ type: 'text', text }],
            metadata: { agent: 'user' },
          });
        }
        continue;
      }

      // TOOL: always accumulate into assistant run
      if (isTool) {
        const toolCallId: string =
          msg?.tool_call_id ||
          msg?.toolCallId ||
          msg?.kwargs?.tool_call_id ||
          `tool_${nowId()}`;

        const toolInput: unknown =
          msg?.input ??
          msg?.kwargs?.input ??
          msg?.additional_kwargs?.input ??
          {};

        const toolOutput =
          typeof msg?.content === 'string'
            ? msg.content
            : JSON.stringify(msg?.content ?? '');

        accParts.push({
          type: `tool-${String(msg?.name ?? 'unknown')}` as const,
          toolCallId,
          state: 'output-available' as const,
          input: toolInput,
          output: toolOutput,
        });

        // prefer latest AI name if present later; don't set agent here
        continue;
      }

      // AI: accumulate non-empty text; skip empty/whitespace AI messages
      if (isAI) {
        const text = String(msg.content ?? '');
        if (text.trim() !== '') {
          accParts.push({ type: 'text', text });
          // update agent when present (last AI name wins within the run)
          if (msg?.name) accAgent = msg.name;
        }
        continue;
      }

      // Unknown: treat as assistant text ONLY if non-empty
      const fallback = String(msg?.content ?? '');
      if (fallback.trim() !== '') {
        accParts.push({ type: 'text', text: fallback });
      }
    }

    // flush any trailing assistant parts
    flushAssistant();

    return messages;
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return [];
  }
}


