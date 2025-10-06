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