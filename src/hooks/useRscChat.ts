'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readStreamableValue, type StreamableValue } from '@ai-sdk/rsc';
import type {
  UIMessage,
  CreateUIMessage,
} from 'ai';
import { type ConciergeStreamEvent } from '@/lib/agent';
import { type RscServerAction, type ChatRequestOptions } from '@/actions/chatbot';

function rid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Options mirror `useChat` but adapted for RSC. */
export type UseRscChatOptions<M extends UIMessage = UIMessage> = {
  /** Provide your RSC server action (transport). */
  action: RscServerAction;

  /** Stable chat id (used for reconnections/routing) */
  id?: string;

  /** Required thread id passed to your action */
  threadId: string;

  /** Initial messages (UIMessage[]) */
  messages?: M[];

  /** Called on assistant message finish */
  onFinish?: (options: { message: M }) => void;

  /** Called on transport error */
  onError?: (error: Error) => void;

  /** Called whenever a "data" part is received (not used in this basic RSC text stream) */
  onData?: (dataPart: unknown) => void;

  /** Whether to try to resume an ongoing stream (reattach handle) */
  resume?: boolean;

  /** Optional auto-send policy hook (mirrors useChat). */
  sendAutomaticallyWhen?: (options: { messages: M[] }) => boolean | Promise<boolean>;
};

/** Result shape mirrors `useChat` public API. */
export type UseRscChatReturn<M extends UIMessage = UIMessage & { metadata: Record<string, unknown> }> = {
  id: string;
  messages: M[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error: Error | undefined;
  sendMessage: (message: CreateUIMessage<M> | string, options?: ChatRequestOptions) => void;
  regenerate: (options?: { messageId?: string }) => void;
  stop: () => void;
  clearError: () => void;
  resumeStream: () => void;
  setMessages: (messages: M[] | ((prev: M[]) => M[])) => void;
  metadata: Record<string, unknown>;
};

/** Utilities to construct UIMessage parts */
function userTextMessage(text: string): CreateUIMessage<UIMessage> {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}
function assistantEmptyMessage(): UIMessage {
  return {
    id: rid(),
    role: 'assistant',
    parts: [],
  };
}
function getFirstTextPart(m: UIMessage | CreateUIMessage<UIMessage>) {
  return (m.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined) ?? null;
}

function appendTextPart(
  m: UIMessage,
  text: string,
  append = true,
  metadata: Record<string, unknown> = {}
): UIMessage {
  const parts = [...m.parts];
  const last = parts[parts.length - 1];

  if (append && last?.type === 'text') {
    const prev = last as { type: 'text'; text: string };
    parts[parts.length - 1] = { ...prev, text: (prev.text || '') + text };
  } else {
    // Last part isn’t text (e.g., a tool just rendered) → start a new text block
    parts.push({ type: 'text', text });
  }

  return {
    ...m,
    parts,
    metadata: { ...(m.metadata ?? {}), ...metadata },
  };
}


function appendToolResult(m: UIMessage, tool: string, output: unknown, metadata: Record<string, unknown> = {}): UIMessage {
  return {
    ...m,
    parts: [...m.parts, { type: `tool-${tool}`, output }] as UIMessage['parts'],
    metadata: { ...metadata },
  };
}

/** Main hook */
export function useRscChat<M extends UIMessage = UIMessage>(
  {
    action,
    id: chatIdProp,
    threadId,
    messages: initialMessages = [],
    onFinish,
    onError,
    onData,
    resume = false,
    sendAutomaticallyWhen,
  }: UseRscChatOptions<M>,
): UseRscChatReturn<M> {
  const chatId = useMemo(() => chatIdProp ?? `rsc-chat-${rid()}`, [chatIdProp]);

  const metadata = useRef<Record<string, unknown>>({});
  const [messages, setMessages] = useState<M[]>(
    () => initialMessages as M[],
  );
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const [error, setError] = useState<Error | undefined>(undefined);

  const [handle, setHandle] = useState<StreamableValue<ConciergeStreamEvent> | null>(null);
  const [isPending, setIsPending] = useState(false);
  const pendingInitRef = useRef(false);

  const streamingMsgId = useRef<string | null>(null);
  const lastHandleRef = useRef<StreamableValue<ConciergeStreamEvent> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!handle || stoppedRef.current) return;

    let isCancelled = false;
    const processStream = async () => {
      try {
        setIsPending(true);
        pendingInitRef.current = true;

        for await (const event of readStreamableValue(handle)) {
          if (isCancelled || stoppedRef.current) break;

          if (!streamingMsgId.current) continue;

          if (event && event.type !== 'current-agent') {
            setStatus('streaming');
          }

          setMessages((prev) => {
            const next = prev.map((m) => {
              if (m.id !== streamingMsgId.current) return m;
              switch (event?.type) {
                case 'token':
                  return appendTextPart(m, event.value, true, event.metadata) as M;
                case 'tool':
                  return appendToolResult(m, event.name, event.data, event.metadata) as M;
                case 'current-agent':
                  metadata.current = { ...metadata.current, currentAgent: event.name };
                  return m;
                default:
                  return m;
              }
            });
            return next as M[];
          });
          onData?.(undefined);
        }

        if (!isCancelled && !stoppedRef.current) {
          setStatus('ready');
          if (streamingMsgId.current) {
            setMessages((currentMessages) => {
              const msg = currentMessages.find((m) => m.id === streamingMsgId.current);
              if (msg) onFinish?.({ message: msg as M });
              return currentMessages;
            });
          }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          setStatus('error');
          onError?.(err);
        }
      } finally {
        if (!isCancelled) {
          setIsPending(false);
          pendingInitRef.current = false;
        }
      }
    };

    processStream();

    return () => {
      isCancelled = true;
    };
  }, [handle, onData, onError, onFinish]);



  useEffect(() => {
    if (!isPending && streamingMsgId.current && pendingInitRef.current) {
      setStatus((s) => (s === 'error' ? s : 'ready'));

      (async () => {
        if (sendAutomaticallyWhen && (await sendAutomaticallyWhen({ messages }))) {
        }
      })();

      pendingInitRef.current = false;
    }
  }, [isPending, messages, sendAutomaticallyWhen]);

  useEffect(() => {
    if (isPending) {
      pendingInitRef.current = true;
    }
  }, [isPending]);


  useEffect(() => {
    if (!resume || !lastHandleRef.current || handle) return;
    setHandle(lastHandleRef.current);
  }, [resume, handle]);


  const clearError = useCallback(() => setError(undefined), []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    setHandle(null);
    setIsPending(false);
    try {
      (lastHandleRef.current as unknown as { abort?: () => void })?.abort?.();
      (lastHandleRef.current as unknown as { cancel?: () => void })?.cancel?.();
    } catch { }
    setStatus('ready');
  }, []);

  const resumeStream = useCallback(() => {
    if (lastHandleRef.current) {
      stoppedRef.current = false;
      setHandle(lastHandleRef.current);
    }
  }, []);

  const baseSend = useCallback(
    async (nextUserText: string, request?: ChatRequestOptions) => {
      if (!nextUserText.trim()) return;

      const userMsg: M = { 
        ...userTextMessage(nextUserText), 
        id: rid(),
        metadata: { inputType: request?.inputType || 'text' }
      } as M;
      const assistantMsg: M = assistantEmptyMessage() as M;

      setMessages((prev) => [...prev, userMsg, assistantMsg] as M[]);
      setStatus('submitted');
      setError(undefined);
      streamingMsgId.current = assistantMsg.id;
      stoppedRef.current = false;

      try {
        const { stream } = await action({
          message: nextUserText,
          threadId,
          extra: request || {},
        });
        const s = stream as StreamableValue<ConciergeStreamEvent>;
        lastHandleRef.current = s;
        setHandle(s);
      } catch (e: unknown) {
        streamingMsgId.current = null;
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setStatus('error');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? appendTextPart(m, 'Sorry, something went wrong.') as M
              : m,
          ) as M[],
        );
        onError?.(err);
      }
    },
    [action, threadId, onError],
  );

  /** Public: sendMessage (matches useChat) */
  const sendMessage = useCallback<UseRscChatReturn<M>['sendMessage']>(
    (message, options) => {
      if(status === 'submitted' || status === 'streaming') {
        return;
      }

      if (typeof message === 'string') {
        return void baseSend(message, options);
      }
      const textPart = getFirstTextPart(message);
      const text = textPart?.text ?? '';
      return void baseSend(text, options);
    },
    [baseSend, status],
  );

  /** Public: regenerate (matches useChat) */
  const regenerate = useCallback<UseRscChatReturn<M>['regenerate']>(
    (opts) => {
      const { messageId } = opts ?? {};
      const idx = (() => {
        if (messageId) return messages.findIndex((m) => m.id === messageId);
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') return i;
        }
        return -1;
      })();
      if (idx === -1) return;

      const userIdx = (() => {
        for (let i = idx - 1; i >= 0; i--) {
          if (messages[i].role === 'user') return i;
        }
        return -1;
      })();
      if (userIdx === -1) return;

      const userText = getFirstTextPart(messages[userIdx])?.text ?? '';
      const originalInputType = (messages[userIdx] as { metadata?: { inputType?: 'text' | 'voice' } })?.metadata?.inputType || 'text';
      setMessages((prev) => prev.slice(0, userIdx + 1) as M[]);
      sendMessage(userText, { inputType: originalInputType as 'text' | 'voice' });
    },
    [messages, sendMessage],
  );

  return {
    id: chatId,
    messages,
    status,
    error,
    sendMessage,
    regenerate,
    stop,
    clearError,
    resumeStream,
    setMessages,
    metadata: metadata.current,
  };
}
