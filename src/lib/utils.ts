import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { CreateSuccess, CreateError } from "@/types/response";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type DebounceFunction = <T extends never[]>(
  func: (...args: T) => void,
  delay: number
) => (...args: T) => void;

export const debounce: DebounceFunction = (func, delay) => {
  let timeoutId: NodeJS.Timeout | null;

  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};

// overloads so TS knows which shape to return
export function createSuccess<T>(data: T, message?: string): CreateSuccess<T> {
  return message ? { ok: true, data, message } : { ok: true, data };
}

export function createError(message: string): CreateError;
export function createError<T>(message: string, errors: T): CreateError<T>;
export function createError(message: string, errors?: unknown) {
  return errors === undefined
    ? { ok: false, message }
    : { ok: false, message, errors };
}

export function generateId(prefix?: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Detect if device is iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detect if browser is Safari
 */
export function isSafari(): boolean {
  if (typeof window === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function jsonToReadableText(obj: Record<string, unknown>): string {
  const flatten = (input: unknown): string => {
    if (input === null || input === undefined) return "";
    if (typeof input === "object") {
      if (Array.isArray(input)) return input.map(flatten).join(", ");
      return Object.entries(input)
        .map(([key, value]) => `${key}: ${flatten(value)}`)
        .join(". ");
    }
    return String(input);
  };

  return flatten(obj);
}
