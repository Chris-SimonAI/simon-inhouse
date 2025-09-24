import {
    useCallback,
    useRef,
    useState,
    useEffect,
    useLayoutEffect as _useLayoutEffect,
  } from 'react';
  import { debounce } from '@/lib/utils';
  
  const useIsoLayoutEffect =
    typeof window !== 'undefined' ? _useLayoutEffect : useEffect;
  
  interface ScrollRestorationOptions {
    debounceTime?: number;
    persist?: false | 'localStorage' | 'sessionStorage';
  }
  
  export function useScrollRestoration<U extends HTMLElement>(
    key: string,
    { debounceTime = 100, persist = false }: ScrollRestorationOptions = {}
  ) {
    const [restoration, setRestoration] = useState<
      Record<string, { scrollTop: number; scrollLeft: number }>
    >({});
  
    const elementRef = useRef<U | null>(null);
    const ref = useCallback((el: U | null) => {
      elementRef.current = el;
    }, []);
  
    const current = restoration[key];
  
    // Restore scroll synchronously to avoid flicker
    useIsoLayoutEffect(() => {
      const el = elementRef.current;
      if (!el) return;
  
      let next = current;
  
      if (!next) {
        // Try persisted value
        if (persist === 'localStorage') {
          const s = localStorage.getItem(`scrollRestoration-${key}`);
          if (s) next = JSON.parse(s);
        } else if (persist === 'sessionStorage') {
          const s = sessionStorage.getItem(`scrollRestoration-${key}`);
          if (s) next = JSON.parse(s);
        }
  
        if (!next) {
          next = { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft };
        }
  
        setRestoration((prev) => ({ ...prev, [key]: next! }));
      }
  
      if (next) {
        el.scrollTo(next.scrollLeft ?? 0, next.scrollTop ?? 0);
      }
    }, [key, persist, current]);
  
    // Track scroll position
    useEffect(() => {
      const el = elementRef.current;
      if (!el) return;
  
      const handler = debounce(() => {
        const scrollTop = el.scrollTop;
        const scrollLeft = el.scrollLeft;
        setRestoration((prev) => ({
          ...prev,
          [key]: { scrollTop, scrollLeft },
        }));
      }, debounceTime);
  
      el.addEventListener('scroll', handler, { passive: true });
      return () => {
        el.removeEventListener('scroll', handler as EventListener);
        (handler as { cancel?: () => void }).cancel?.();
      };
    }, [debounceTime, key]);
  
    // Persist to storage
    useEffect(() => {
      if (!persist || !current) return;
      const payload = JSON.stringify(current);
      if (persist === 'localStorage') {
        localStorage.setItem(`scrollRestoration-${key}`, payload);
      } else if (persist === 'sessionStorage') {
        sessionStorage.setItem(`scrollRestoration-${key}`, payload);
      }
    }, [key, persist, current]);
  
    // Imperative setter
    const setScroll = ({ x, y }: { x?: number; y?: number }) => {
      setRestoration((prev) => {
        const prevEntry = prev[key] ?? { scrollLeft: 0, scrollTop: 0 };
        return {
          ...prev,
          [key]: {
            scrollLeft: x ?? prevEntry.scrollLeft,
            scrollTop: y ?? prevEntry.scrollTop,
          },
        };
      });
      const el = elementRef.current;
      if (el) el.scrollTo(x ?? el.scrollLeft, y ?? el.scrollTop);
    };
  
    return { ref, setScroll };
  }
  