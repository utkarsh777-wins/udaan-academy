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
const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const HI_MONTHS = [
  "जनवरी",
  "फरवरी",
  "मार्च",
  "अप्रैल",
  "मई",
  "जून",
  "जुलाई",
  "अगस्त",
  "सितंबर",
  "अक्टूबर",
  "नवंबर",
  "दिसंबर",
];
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

export function windowExample(now = new Date()): {
  iso: string;
  slash: string;
  dayMonth: Record<"en" | "hi" | "pa", string>;
} {
  const iso = addISODays(todayISO(now), 7);
  const [year, month, day] = iso.split("-").map(Number);
  const name = (names: readonly string[]) => `${day} ${names[month - 1]}`;
  return {
    iso,
    slash: `${day}/${month}/${year}`,
    dayMonth: {
      en: name(EN_MONTHS),
      hi: name(HI_MONTHS),
      pa: name(PA_MONTHS),
    },
  };
}

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

export const WEEKDAY_SHORT = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  hi: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"],
  pa: ["ਸੋਮ", "ਮੰਗਲ", "ਬੁੱਧ", "ਵੀਰ", "ਸ਼ੁੱਕਰ", "ਸ਼ਨੀ", "ਐਤ"],
} as const;

export function formatMonthHeading(year: number, month: number, language: "en" | "hi" | "pa" = "en"): string {
  if (language === "pa") {
    return `${PA_MONTHS[month - 1]} ${year}`;
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface CalendarCell {
  iso: string;
  day: number;
  bookable: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  key: string;
  weeks: CalendarCell[][];
}

export function buildCalendarWeeks(dates: readonly string[]): CalendarMonth[] {
  if (!dates.length) return [];
  const monthMap = new Map<string, string[]>();
  for (const d of dates) {
    const ym = d.slice(0, 7);
    const existing = monthMap.get(ym);
    if (existing) existing.push(d);
    else monthMap.set(ym, [d]);
  }

  const result: CalendarMonth[] = [];
  for (const [ym, mDates] of monthMap.entries()) {
    const [year, month] = ym.split("-").map(Number);
    const minDate = mDates[0];
    const maxDate = mDates[mDates.length - 1];
    const minCol = (new Date(`${minDate}T00:00:00Z`).getUTCDay() + 6) % 7;
    const startMonday = addISODays(minDate, -minCol);
    const maxCol = (new Date(`${maxDate}T00:00:00Z`).getUTCDay() + 6) % 7;
    const endSunday = addISODays(maxDate, 6 - maxCol);

    const weeks: CalendarCell[][] = [];
    let cursor = startMonday;
    while (cursor <= endSunday) {
      const week: CalendarCell[] = [];
      for (let c = 0; c < 7; c++) {
        const curISO = addISODays(cursor, c);
        const inThisMonth = curISO.startsWith(ym);
        const bookable = inThisMonth && mDates.includes(curISO);
        week.push({
          iso: curISO,
          day: Number(curISO.slice(8, 10)),
          bookable,
        });
      }
      weeks.push(week);
      cursor = addISODays(cursor, 7);
    }
    result.push({ year, month, key: ym, weeks });
  }
  return result;
}
