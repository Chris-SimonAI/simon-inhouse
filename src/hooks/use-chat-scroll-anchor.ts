// IMPORTANT: This hook is used to restore the scroll position when the user navigates back to the chatbot
// IT IS MAINLY USED FOR THE CHATBOT ONLY

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { UIMessage } from "ai";

const SCROLL_STORAGE_NAMESPACE = "scrollRestoration-conversationScroll";
const MAX_RESTORE_ATTEMPTS = 6;

type StoredAnchor = {
  anchorId: string;
  offsetRatio: number;
  offset: number;
  index: number;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const escapeForSelector = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
};

const readStoredAnchor = (storageKey: string): StoredAnchor | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const payload =
    window.localStorage.getItem(storageKey) ??
    window.localStorage.getItem(SCROLL_STORAGE_NAMESPACE);

  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<StoredAnchor>;

    if (
      parsed &&
      typeof parsed.anchorId === "string" &&
      typeof parsed.offset === "number" &&
      typeof parsed.index === "number"
    ) {
      const ratio =
        typeof parsed.offsetRatio === "number" && Number.isFinite(parsed.offsetRatio)
          ? parsed.offsetRatio
          : 0;

      return {
        anchorId: parsed.anchorId,
        offset: parsed.offset,
        offsetRatio: ratio,
        index: parsed.index,
      };
    }
  } catch (error) {
    console.warn("Failed to parse stored chat anchor", error);
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }

  return null;
};

const writeStoredAnchor = (storageKey: string, anchor: StoredAnchor) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(anchor));
    if (storageKey !== SCROLL_STORAGE_NAMESPACE) {
      window.localStorage.removeItem(SCROLL_STORAGE_NAMESPACE);
    }
  } catch (error) {
    console.warn("Failed to persist chat anchor", error);
  }
};

type UseChatScrollAnchorArgs = {
  threadId: string;
  messages: UIMessage[];
  isActive: boolean;
};

type UseChatScrollAnchorResult = {
  attachScrollEl: (el: HTMLElement | null) => void;
  restoreScroll: () => void;
};

export function useChatScrollAnchor({
  threadId,
  messages,
  isActive,
}: UseChatScrollAnchorArgs): UseChatScrollAnchorResult {
  const storageKey = `${SCROLL_STORAGE_NAMESPACE}-${threadId}`;
  const messagesRef = useRef(messages);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const removeListenersRef = useRef<(() => void) | null>(null);
  const anchorDataRef = useRef<StoredAnchor | null>(null);
  const hasRestoredRef = useRef(false);
  const pendingRestoreRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const restoreRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      removeListenersRef.current?.();
      removeListenersRef.current = null;

      if (restoreRafRef.current !== null) {
        cancelAnimationFrame(restoreRafRef.current);
        restoreRafRef.current = null;
      }

      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void threadId;
    anchorDataRef.current = null;
    hasRestoredRef.current = false;
    pendingRestoreRef.current = false;
  }, [threadId]);

  useEffect(() => {
    if (!isActive) {
      pendingRestoreRef.current = false;
      hasRestoredRef.current = false;

      if (restoreRafRef.current !== null) {
        cancelAnimationFrame(restoreRafRef.current);
        restoreRafRef.current = null;
      }
    }
  }, [isActive]);

  const computeAnchor = useCallback((): StoredAnchor | null => {
    const container = scrollElementRef.current;

    if (!container) {
      return null;
    }

    const messageEls = container.querySelectorAll<HTMLElement>("[data-message-id]");

    if (!messageEls.length) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    let anchorEl: HTMLElement | null = null;

    for (const el of messageEls) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > containerRect.top + 1) {
        anchorEl = el;
        break;
      }
    }

    if (!anchorEl) {
      anchorEl = messageEls[messageEls.length - 1] ?? null;
    }

    if (!anchorEl) {
      return null;
    }

    const anchorId = anchorEl.dataset.messageId;

    if (!anchorId) {
      return null;
    }

    const anchorRect = anchorEl.getBoundingClientRect();
    const messageHeight = anchorRect.height || anchorEl.offsetHeight || 1;
    const hidden = clamp(containerRect.top - anchorRect.top, 0, messageHeight);
    const offsetRatio = messageHeight ? hidden / messageHeight : 0;

    const list = messagesRef.current;
    const rawIndex = list.findIndex((message) => message.id === anchorId);
    const index = rawIndex === -1 ? 0 : rawIndex;

    const anchor = {
      anchorId,
      offsetRatio,
      offset: hidden,
      index,
    };

    return anchor;
  }, []);

  const saveAnchor = useCallback(() => {
    if (pendingRestoreRef.current) {
      return;
    }

    const anchor = computeAnchor();

    if (!anchor) {
      return;
    }

    anchorDataRef.current = anchor;

    if (!hasRestoredRef.current) {
      return;
    }

    writeStoredAnchor(storageKey, anchor);
  }, [computeAnchor, storageKey]);

  const attemptRestore = useCallback(() => {
    if (!isActive) {
      return false;
    }

    const container = scrollElementRef.current;

    if (!container) {
      return false;
    }

    if (anchorDataRef.current === null) {
      anchorDataRef.current = readStoredAnchor(storageKey);
    }

    const stored = anchorDataRef.current;

    if (!stored) {
      return true;
    }

    const list = messagesRef.current;

    if (!list.length) {
      return false;
    }

    const candidateIds: string[] = [];

    if (stored.anchorId) {
      candidateIds.push(stored.anchorId);
    }

    if (
      typeof stored.index === "number" &&
      stored.index >= 0 &&
      stored.index < list.length
    ) {
      const fallbackId = list[stored.index]?.id;
      if (fallbackId && !candidateIds.includes(fallbackId)) {
        candidateIds.push(fallbackId);
      }
    }

    const firstId = list[0]?.id;
    if (firstId && !candidateIds.includes(firstId)) {
      candidateIds.push(firstId);
    }

    const lastId = list[list.length - 1]?.id;
    if (lastId && !candidateIds.includes(lastId)) {
      candidateIds.push(lastId);
    }

    let anchorEl: HTMLElement | null = null;
    let resolvedId: string | null = null;

    for (const candidate of candidateIds) {
      const selector = `[data-message-id="${escapeForSelector(candidate)}"]`;
      const el = container.querySelector<HTMLElement>(selector);

      if (el) {
        anchorEl = el;
        resolvedId = candidate;
        break;
      }
    }

    if (!anchorEl || !resolvedId) {
      return false;
    }

    const containerRect = container.getBoundingClientRect();
    const beforeRect = anchorEl.getBoundingClientRect();
    const messageHeight = beforeRect.height || anchorEl.offsetHeight || 1;

    const desiredHiddenRaw =
      typeof stored.offsetRatio === "number" && Number.isFinite(stored.offsetRatio) && messageHeight
        ? stored.offsetRatio * messageHeight
        : stored.offset;

    const desiredHidden = clamp(desiredHiddenRaw ?? 0, 0, messageHeight);
    const anchorOffset = beforeRect.top - containerRect.top + container.scrollTop;
    const containerMaxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
    const targetScrollTop = clamp(anchorOffset + desiredHidden, 0, containerMaxScroll);

    const delta = targetScrollTop - container.scrollTop;

    if (Math.abs(delta) > 0.5) {
      container.scrollTop = targetScrollTop;
    }

    const afterRect = anchorEl.getBoundingClientRect();
    const updatedAnchorOffset = afterRect.top - containerRect.top + container.scrollTop;
    const updatedHidden = clamp(container.scrollTop - updatedAnchorOffset, 0, messageHeight);
    const withinTolerance = Math.abs(updatedHidden - desiredHidden) <= 1.5;

    const resolvedIndex = list.findIndex((message) => message.id === resolvedId);
    const nextIndex = resolvedIndex === -1 ? stored.index : resolvedIndex;

    if (withinTolerance) {
      anchorDataRef.current = {
        anchorId: resolvedId,
        offset: updatedHidden,
        offsetRatio: messageHeight ? updatedHidden / messageHeight : stored.offsetRatio,
        index: nextIndex,
      };
    } else {
      anchorDataRef.current = {
        anchorId: resolvedId,
        offset: desiredHidden,
        offsetRatio: messageHeight ? desiredHidden / messageHeight : stored.offsetRatio,
        index: nextIndex,
      };
    }

    return withinTolerance;
  }, [isActive, storageKey]);

  const runRestore = useCallback(() => {
    restoreRafRef.current = null;

    if (!pendingRestoreRef.current) {
      if (hasRestoredRef.current) {
        return;
      }

      pendingRestoreRef.current = true;
      restoreAttemptsRef.current = 0;
    }

    const success = attemptRestore();

    if (success) {
      pendingRestoreRef.current = false;
      hasRestoredRef.current = true;
      saveAnchor();
      return;
    }

    restoreAttemptsRef.current += 1;

    if (restoreAttemptsRef.current >= MAX_RESTORE_ATTEMPTS) {
      pendingRestoreRef.current = false;
      return;
    }

    restoreRafRef.current = window.requestAnimationFrame(runRestore);
  }, [attemptRestore, saveAnchor]);

  const restoreScroll = useCallback(() => {
    pendingRestoreRef.current = true;
    restoreAttemptsRef.current = 0;
    hasRestoredRef.current = false;

    if (restoreRafRef.current !== null) {
      cancelAnimationFrame(restoreRafRef.current);
      restoreRafRef.current = null;
    }

    if (!scrollElementRef.current) {
      return;
    }

    restoreRafRef.current = window.requestAnimationFrame(runRestore);
  }, [runRestore]);

  const handleScroll = useCallback(() => {
    hasRestoredRef.current = true;

    if (scrollRafRef.current !== null) {
      return;
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      saveAnchor();
    });
  }, [saveAnchor]);

  const attachScrollEl = useCallback(
    (el: HTMLElement | null) => {
      if (scrollElementRef.current && scrollElementRef.current !== el) {
        saveAnchor();
      }

      removeListenersRef.current?.();
      removeListenersRef.current = null;

      scrollElementRef.current = el;

      if (!el) {
        return;
      }

      const onScroll = () => {
        handleScroll();
      };

      el.addEventListener("scroll", onScroll, { passive: true });

      let resizeObserver: ResizeObserver | null = null;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (!pendingRestoreRef.current) {
            saveAnchor();
          }
        });
        resizeObserver.observe(el);
      }

      removeListenersRef.current = () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        el.removeEventListener("scroll", onScroll);
      };

      if (!isActive) {
        hasRestoredRef.current = false;
        return;
      }

      if (pendingRestoreRef.current) {
        if (restoreRafRef.current !== null) {
          cancelAnimationFrame(restoreRafRef.current);
        }
        restoreRafRef.current = window.requestAnimationFrame(runRestore);
      } else if (!hasRestoredRef.current && anchorDataRef.current !== null) {
        pendingRestoreRef.current = true;
        restoreAttemptsRef.current = 0;
        if (restoreRafRef.current !== null) {
          cancelAnimationFrame(restoreRafRef.current);
        }
        restoreRafRef.current = window.requestAnimationFrame(runRestore);
      }
    },
    [handleScroll, isActive, runRestore, saveAnchor]
  );

  useLayoutEffect(() => {
    if (!scrollElementRef.current || pendingRestoreRef.current) {
      return;
    }

    if (!messages.length) {
      return;
    }

    saveAnchor();
  }, [messages, saveAnchor]);

  return { attachScrollEl, restoreScroll };
}

