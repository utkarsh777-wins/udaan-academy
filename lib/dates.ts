export function kolkataParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function toISODate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayISO(now = new Date()): string {
  const parts = kolkataParts(now);
  return toISODate(parts.year, parts.month, parts.day);
}

export function addISODays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const PA_WEEKDAYS = ["ਐਤ", "ਸੋਮ", "ਮੰਗਲ", "ਬੁੱਧ", "ਵੀਰ", "ਸ਼ੁੱਕਰ", "ਸ਼ਨੀ"];
const PA_MONTHS = [
  "ਜਨਵਰੀ",
  "ਫ਼ਰਵਰੀ",
  "ਮਾਰਚ",
  "ਅਪ੍ਰੈਲ",
  "ਮਈ",
  "ਜੂਨ",
  "ਜੁਲਾਈ",
  "ਅਗਸਤ",
  "ਸਤੰਬਰ",
  "ਅਕਤੂਬਰ",
  "ਨਵੰਬਰ",
  "ਦਸੰਬਰ",
];

export function formatLongDate(iso: string, language: "en" | "hi" | "pa" = "en"): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (language === "pa") {
    return `${PA_WEEKDAYS[date.getUTCDay()]}, ${day} ${PA_MONTHS[month - 1]} ${year}`;
  }
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateChip(iso: string, language: "en" | "hi" | "pa" = "en"): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (language === "pa") {
    return `${PA_WEEKDAYS[date.getUTCDay()]}, ${day} ${PA_MONTHS[month - 1]}`;
  }
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: language === "hi" ? "long" : "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateChipAria(iso: string, language: "en" | "hi" | "pa" = "en"): string {
  const [year] = iso.split("-");
  return `${formatDateChip(iso, language)} ${year}`;
}
