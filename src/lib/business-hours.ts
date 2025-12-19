import { businessHoursSchema, dayKeySchema, type BusinessHoursDayKey } from "@/validations/business-hours";

type BusinessHoursWindow = {
  open: string;
  close: string;
  isOvernight: boolean;
};

function formatTime12h(time24h: string): string {
  const [hh, mm] = time24h.split(":");
  const hour = Number(hh);
  const minute = Number(mm);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time24h;

  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = ((hour + 11) % 12) + 1;
  const minutePadded = String(minute).padStart(2, "0");
  return `${hour12}:${minutePadded} ${suffix}`;
}

function getLocalDayKey(now: Date): BusinessHoursDayKey | null {
  try {
    // Uses the user's browser/device local timezone implicitly.
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now);
    const normalized = weekday.trim().toLowerCase();
    const parsed = dayKeySchema.safeParse(normalized);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Returns a single line like: "Hours 11:00 am to 9:00 pm"
 * Uses normalized hours if present. Picks the weekday from the user's browser/device local time.
 */
export function formatRestaurantHoursLine(
  businessHours: unknown,
): string | null {
  const parsed = businessHoursSchema.safeParse(businessHours);
  if (!parsed.success) return null;

  const normalized = parsed.data.normalized;
  if (!normalized) return null;

  const now = new Date();
  const dayKey = getLocalDayKey(now);
  if (!dayKey) return null;

  const windows = normalized[dayKey] as BusinessHoursWindow[] | undefined;
  if (!windows || windows.length === 0) return null;

  const segments = windows
    .map((w) => `Hours ${formatTime12h(w.open)} to ${formatTime12h(w.close)}`)
    // If multiple windows exist, don't repeat "Hours " for each segment.
    .map((s, idx) => (idx === 0 ? s : s.replace(/^Hours\s+/, "")));

  return segments.join(", ");
}

