import { addISODays, todayISO } from "@/lib/dates";

export function weekdayIndex(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function batchHasEnded(timeLabel: string, date: string, now: Date): boolean {
  if (date !== todayISO(now)) return false;
  const end = endMinutes(timeLabel);
  if (end == null) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute >= end;
}

function endMinutes(timeLabel: string): number | null {
  const shared = timeLabel.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (shared) {
    return clockMinutes(Number(shared[3]), Number(shared[4]), shared[5].toLowerCase() as "am" | "pm");
  }
  const split = timeLabel.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!split) return null;
  return clockMinutes(Number(split[4]), Number(split[5]), split[6].toLowerCase() as "am" | "pm");
}

function clockMinutes(hour: number, minute: number, meridiem: "am" | "pm"): number {
  let normalized = hour % 12;
  if (meridiem === "pm") normalized += 12;
  return normalized * 60 + minute;
}

export function bookableDates(weekdays: readonly number[], timeLabel: string, now = new Date()): string[] {
  const start = todayISO(now);
  const latest = addISODays(start, 45);
  const dates: string[] = [];
  for (let cursor = start; cursor <= latest; cursor = addISODays(cursor, 1)) {
    if (!weekdays.includes(weekdayIndex(cursor))) continue;
    if (batchHasEnded(timeLabel, cursor, now)) continue;
    dates.push(cursor);
  }
  return dates;
}

export function nextOpenDate(from: string, weekdays: readonly number[], latest: string): string | null {
  for (let offset = 1; offset <= 21; offset += 1) {
    const cursor = addISODays(from, offset);
    if (cursor > latest) return null;
    if (weekdays.includes(weekdayIndex(cursor))) return cursor;
  }
  return null;
}
