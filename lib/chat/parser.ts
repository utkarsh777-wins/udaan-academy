import { academy, type BatchId, type Course } from "@/lib/academy";
import { addISODays, isISODate, todayISO, toISODate } from "@/lib/dates";
import { weekdayIndex } from "@/lib/schedule";

export type Intent =
  | "greeting"
  | "fees"
  | "phone"
  | "batches"
  | "eligibility"
  | "recommend"
  | "book"
  | "admission"
  | "status"
  | "off_topic"
  | "party"
  | "unknown";

export type DayPeriod = "morning" | "afternoon" | "evening" | "night" | "weekend";

export type ClockTime = {
  hour: number;
  minute: number;
};

export type ParseResult = {
  intent: Intent;
  courses: string[];
  batch: BatchId | null;
  period: DayPeriod | null;
  time: ClockTime | null;
  partySize: number | null;
  phone: string | null;
  name: string | null;
  date: string | null;
  greeting: boolean;
};

const DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
  "੦": "0",
  "੧": "1",
  "੨": "2",
  "੩": "3",
  "੪": "4",
  "੫": "5",
  "੬": "6",
  "੭": "7",
  "੮": "8",
  "੯": "9",
};

/**
 * Words and numbers, keeping combining marks (\p{M}) on the base letter.
 * Word boundaries are not used: \b does not work after Indic letters.
 */
const TOKEN =
  /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?|\p{N}+(?:[.:]\p{N}+)?/gu;

export function tokenize(input: string): string[] {
  const text = input.normalize("NFC");
  return [...text.matchAll(TOKEN)].map((match) => match[0]);
}

export function fold(input: string): string {
  const mapped = [...input.normalize("NFC")]
    .map((char) => DIGITS[char] ?? char)
    .join("")
    .toLowerCase();
  return mapped.replaceAll("ਸ਼", "ਸ਼");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function includesTerm(text: string, term: string): boolean {
  const hay = fold(text);
  const needle = fold(term);
  if (!needle) return false;
  if (/[^\u0000-\u007f]/.test(needle)) {
    const right = needle.includes(" ") ? "" : "(?![\\p{L}\\p{M}])";
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{M}])${escapeRegExp(needle)}${right}`, "u");
    return pattern.test(hay);
  }
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:$|[^a-z0-9])`,
    "i",
  );
  return pattern.test(hay);
}

const COUNT_WORDS = new Set(
  ["people", "persons", "person", "students", "student", "folks", "लोग", "लोगों", "लोगो", "ਲੋਕ", "ਲੋਕਾਂ"].map(
    fold,
  ),
);

const CLOCK_MARKERS = new Set(
  ["am", "pm", "a.m", "p.m", "a.m.", "p.m.", "बजे", "baje", "वजे", "ਵਜੇ", "o'clock", "oclock"].map(
    fold,
  ),
);

const MORNING = ["morning", "सुबह", "सवेरे", "सवेरा", "तड़के", "ਸਵੇਰ", "ਸਵੇਰੇ"].map(fold);
const AFTERNOON = ["afternoon", "दोपहर", "ਦੁਪਹਿਰ"].map(fold);
const EVENING = ["evening", "शाम", "ਸ਼ਾਮ"].map(fold);
const NIGHT = ["night", "रात", "रात्रि", "ਰਾਤ"].map(fold);
const WEEKEND = ["weekend", "वीकेंड", "वीकएंड", "ਵੀਕਐਂਡ"].map(fold);

const GREETING_WORDS = new Set(
  [
    "hi",
    "hello",
    "hey",
    "namaste",
    "namaskar",
    "namaskaar",
    "sat",
    "sri",
    "srī",
    "akal",
    "ji",
    "good",
    "morning",
    "evening",
    "नमस्ते",
    "नमस्कार",
    "हाय",
    "हैलो",
    "राम",
    "ਸਤ",
    "ਸ੍ਰੀ",
    "ਅਕਾਲ",
    "ਹੈਲੋ",
    "ਜੀ",
    "ਨਮਸਤੇ",
    "ਨਮਸਕਾਰ",
  ].map(fold),
);

const FEE_TERMS = [
  "fee",
  "fees",
  "charges",
  "charge",
  "cost",
  "price",
  "how much",
  "फीस",
  "शुल्क",
  "कितने पैसे",
  "ਫੀਸ",
  "ਕਿੰਨੇ ਪੈਸੇ",
];

const PHONE_ASK = [
  "phone",
  "phone number",
  "contact number",
  "your number",
  "whatsapp",
  "call you",
  "फोन",
  "नंबर क्या",
  "नम्बर क्या",
  "मोबाइल",
  "ਫੋਨ",
  "ਫ਼ੋਨ",
  "ਨੰਬਰ ਕੀ",
];

const BOOK_TERMS = [
  "book",
  "booking",
  "trial",
  "sign up",
  "free class",
  "बुक",
  "ट्रायल",
  "फ्री क्लास",
  "ਬੁੱਕ",
  "ਟਰਾਇਲ",
  "ਫ੍ਰੀ ਕਲਾਸ",
];

const BOOK_VERBS = ["book", "trial", "sign up", "free class", "बुक", "ट्रायल", "फ्री क्लास", "ਬੁੱਕ", "ਟਰਾਇਲ", "ਫ੍ਰੀ ਕਲਾਸ"];

const ADMISSION_TERMS = [
  "admission",
  "join",
  "how to join",
  "enrol",
  "enroll",
  "एडमिशन",
  "दाखिला",
  "दाखिले",
  "ਦਾਖਲਾ",
];

const BATCH_TERMS = [
  "batch",
  "batches",
  "timing",
  "timings",
  "schedule",
  "what time",
  "which batch",
  "बैच",
  "टाइमिंग",
  "समय",
  "कब",
  "ਬੈਚ",
  "ਸਮਾਂ",
  "ਕਦੋਂ",
];

const ELIGIBILITY_TERMS = [
  "eligibility",
  "eligible",
  "who can join",
  "qualification",
  "criteria",
  "योग्यता",
  "योग्य",
  "कौन पढ़",
  "कौन कर",
  "कौन एडमिशन",
  "कौन आ सकता",
  "can i join",
  "can join",
  "ਯੋਗਤਾ",
  "ਕੌਣ ਕਰ",
  "ਕੌਣ ਪੜ੍ਹ",
  "ਕੌਣ ਦਾਖਲਾ",
];

const OFF_TOPIC = [
  "weather",
  "cricket",
  "movie",
  "politics",
  "recipe",
  "football",
  "ipl",
  "मौसम",
  "क्रिकेट",
  "फिल्म",
  "राजनीति",
  "ਮੌਸਮ",
  "ਕ੍ਰਿਕਟ",
  "ਫਿਲਮ",
  "ਰਾਜਨੀਤੀ",
];

const MONTHS: Record<string, number> = Object.fromEntries(
  Object.entries({
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
    जनवरी: 1,
    फरवरी: 2,
    फ़रवरी: 2,
    मार्च: 3,
    अप्रैल: 4,
    मई: 5,
    जून: 6,
    जुलाई: 7,
    अगस्त: 8,
    सितंबर: 9,
    सितम्बर: 9,
    अक्टूबर: 10,
    अक्तूबर: 10,
    नवंबर: 11,
    नवम्बर: 11,
    दिसंबर: 12,
    दिसम्बर: 12,
    ਜਨਵਰੀ: 1,
    ਫਰਵਰੀ: 2,
    ਫ਼ਰਵਰੀ: 2,
    ਮਾਰਚ: 3,
    ਅਪ੍ਰੈਲ: 4,
    ਮਈ: 5,
    ਜੂਨ: 6,
    ਜੁਲਾਈ: 7,
    ਅਗਸਤ: 8,
    ਸਤੰਬਰ: 9,
    ਅਕਤੂਬਰ: 10,
    ਨਵੰਬਰ: 11,
    ਦਸੰਬਰ: 12,
  }).map(([key, value]) => [fold(key), value]),
);

function normToken(token: string): string {
  return fold(token);
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => includesTerm(text, term));
}

function numericToken(token: string): { value: number; minute: number; clock: boolean } | null {
  const folded = foldDigits(token);
  const match = folded.match(/^(\d{1,4})(?:[.:](\d{2}))?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (minute > 59) return null;
  return { value, minute, clock: Boolean(match[2]) };
}

function foldDigits(token: string): string {
  return [...token].map((char) => DIGITS[char] ?? char).join("");
}

function periodOf(token: string): DayPeriod | null {
  const norm = normToken(token);
  if (WEEKEND.includes(norm)) return "weekend";
  if (MORNING.includes(norm)) return "morning";
  if (AFTERNOON.includes(norm)) return "afternoon";
  if (EVENING.includes(norm)) return "evening";
  if (NIGHT.includes(norm)) return "night";
  return null;
}

function scanQuantities(tokens: string[]): {
  partySize: number | null;
  time: ClockTime | null;
} {
  let partySize: number | null = null;
  let time: ClockTime | null = null;
  const norms = tokens.map(normToken);

  for (let index = 0; index < tokens.length; index += 1) {
    const numeric = numericToken(tokens[index]);
    if (!numeric || numeric.value > 99) continue;
    const next = norms[index + 1] ?? "";
    const prev = norms[index - 1] ?? "";

    if (COUNT_WORDS.has(next)) {
      partySize = numeric.value;
      continue;
    }

    const nextPeriod = periodOf(tokens[index + 1] ?? "");
    const prevPeriod = periodOf(tokens[index - 1] ?? "");
    const nextIsClock = CLOCK_MARKERS.has(next);
    const besidePeriod = nextPeriod !== null || prevPeriod !== null;

    if (!(numeric.clock || nextIsClock || besidePeriod)) continue;

    let hour = numeric.value;
    const morningBeside = prevPeriod === "morning" || nextPeriod === "morning";
    const afternoonBeside = prevPeriod === "afternoon" || nextPeriod === "afternoon";
    if ((next === "pm" || next === "p.m" || next === "p.m.") && hour < 12) hour += 12;
    if ((next === "am" || next === "a.m" || next === "a.m.") && hour === 12) hour = 0;
    if (nextIsClock && !numeric.clock && hour >= 1 && hour <= 7 && !morningBeside) hour += 12;
    if (afternoonBeside && hour < 12) hour += 12;
    if (hour > 23) continue;
    time = { hour, minute: numeric.minute };
    void prev;
  }

  return { partySize, time };
}

function periodFromTokens(tokens: string[]): DayPeriod | null {
  let period: DayPeriod | null = null;
  for (const token of tokens) {
    const next = periodOf(token);
    if (!next) continue;
    if (next === "weekend") return "weekend";
    period = next;
  }
  return period;
}

function batchFrom(period: DayPeriod | null, time: ClockTime | null): BatchId | null {
  if (period === "weekend") return "weekend";
  if (period === "morning") return "morning";
  if (period === "evening" || period === "night") return "evening";
  if (!time) return null;
  if (time.hour >= 5 && time.hour < 12) return "morning";
  if (time.hour >= 15 && time.hour <= 21) return "evening";
  return null;
}

export function matchCourses(text: string, courses: Course[] = academy.courses): string[] {
  return courses
    .filter((course) => course.match.some((term) => includesTerm(text, term)))
    .map((course) => course.slug);
}

function extractPhone(text: string): string | null {
  const folded = fold(text);
  for (const match of folded.matchAll(/(?<!\d)(?:\+?91[\s-]*|0)?[6-9](?:[\s-]*\d){9}(?!\d)/g)) {
    const digits = match[0].replace(/\D/g, "").replace(/^(?:91|0)(?=[6-9]\d{9}$)/, "");
    if (/^[6-9]\d{9}$/.test(digits)) return digits;
  }
  return null;
}

function extractName(text: string): string | null {
  const source = text.normalize("NFC").trim();
  const patterns = [
    /my name is\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/iu,
    /^(?:i'?m|i am)\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})$/iu,
    /^(?:मैं|main)\s+(.+?)\s+(?:हूँ|हूं|हैं)$/u,
    /^ਮੈਂ\s+(.+?)\s+ਹਾਂ$/u,
    /मेरा नाम(?:\s+है)?\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u,
    /^(?:नाम|name)\s*[:：]\s*([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})$/iu,
    /ਮੇਰਾ ਨਾਂ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u,
    /ਮੇਰਾ ਨਾਮ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u,
    /^ਨਾਂ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})\s+ਹੈ$/u,
    /^ਨਾਮ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})\s+ਹੈ$/u,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const name = cleanName(match[1]);
    if (name) return name;
  }
  return nameBesidePhone(source);
}

function nameBesidePhone(source: string): string | null {
  const folded = fold(source);
  const match = folded.match(/(?<!\d)(?:\+?91[\s-]*|0)?[6-9](?:[\s-]*\d){9}(?!\d)/);
  if (!match || match.index == null) return null;
  const before = source.slice(0, match.index);
  const segment = before.split(/[।.!?]/u).at(-1) ?? before;
  const words = segment
    .replace(/[,，:：]\s*$/u, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (let size = Math.min(3, words.length); size >= 1; size -= 1) {
    const name = cleanName(words.slice(-size).join(" "));
    if (name) return name;
  }
  return null;
}

function cleanName(value: string): string | null {
  const cut = value.split(/\s+(?:and|aur|ਅਤੇ|phone|फोन|ਫੋਨ|,)/i)[0] ?? value;
  const name = cut
    .replace(/[।.!?]+$/g, "")
    .replace(/(?:\s+(?:है|हैं|हूँ|हूं|जी|ਹੈ|ਹਾਂ|ਜੀ))+$/u, "")
    .trim();
  if (!isPersonName(name)) return null;
  return name;
}

const RESERVED_NAMES = new Set(
  [
    "cancel",
    "cancelled",
    "stop",
    "stopped",
    "ruko",
    "ruk",
    "wait",
    "waiting",
    "go",
    "ahead",
    "go ahead",
    "theek",
    "thik",
    "theek hai",
    "thik hai",
    "ok",
    "okay",
    "sure",
    "yes",
    "haan",
    "ठीक",
    "ठीक है",
    "ਰੁਕੋ",
    "ਰੱਦ",
    "रुको",
    "रुकिए",
    "रद्द",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "रविवार",
    "सोमवार",
    "मंगलवार",
    "बुधवार",
    "गुरुवार",
    "शुक्रवार",
    "शनिवार",
    "ਐਤਵਾਰ",
    "ਸੋਮਵਾਰ",
    "ਮੰਗਲਵਾਰ",
    "ਬੁੱਧਵਾਰ",
    "ਵੀਰਵਾਰ",
    "ਸ਼ੁੱਕਰਵਾਰ",
    "ਸ਼ਨੀਵਾਰ",
  ].map(fold),
);

export function isPersonName(value: string): boolean {
  const name = value.trim();
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,59}$/u.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length > 4) return false;
  if (RESERVED_NAMES.has(fold(name))) return false;
  const blocked = new Set([
    "ielts",
    "pte",
    "neet",
    "jee",
    "fee",
    "fees",
    "book",
    "the",
    "and",
    "class",
    "medical",
    "morning",
    "evening",
    "weekend",
    "tomorrow",
    "today",
    "please",
    "yes",
    "no",
    "ok",
    "okay",
    "trial",
    "हाँ",
    "हां",
    "नहीं",
    "कल",
    "आज",
    "बजे",
    "सुबह",
    "शाम",
    "ट्रायल",
    "बुक",
    "क्लास",
    "करनी",
    "है",
    "हैं",
    "हूँ",
    "हूं",
    "call",
    "me",
    "change",
    "changing",
    "wrong",
    "बदल",
    "बदलना",
    "बदलो",
    "बदलिए",
    "बदलें",
    "गलत",
    "ਬਦਲ",
    "ਬਦਲਣਾ",
    "ਬਦਲੋ",
    "ਗਲਤ",
    "not",
    "sure",
    "maybe",
    "pata",
    "nahi",
    "पता",
    "ਪਤਾ",
    "for",
    "i'm",
    "im",
    "के",
    "लिए",
    "बेटी",
    "बेटा",
    "ਲਈ",
    "ਹਾਂ",
    "ਨਹੀਂ",
    "ਅੱਜ",
    "ਟਰਾਇਲ",
    "ਬੁੱਕ",
    "ਕਲਾਸ",
    "ਕਰਨੀ",
    "ਹੈ",
  ]);
  if (words.some((word) => blocked.has(fold(word)) || RESERVED_NAMES.has(fold(word)))) return false;
  return true;
}

function extractDate(text: string, now: Date): string | null {
  const cleaned = text.replace(/(\d)(?:st|nd|rd|th)(?![a-z])/gi, "$1");
  const tokens = tokenize(cleaned).map((token) => fold(token));
  if (includesTerm(text, "today") || tokens.includes(fold("आज")) || tokens.includes(fold("ਅੱਜ"))) {
    return todayISO(now);
  }
  if (
    includesTerm(text, "day after tomorrow") ||
    ["परसों", "परसो", "ਪਰਸੋਂ", "ਪਰਸੋ"].some((word) => tokens.includes(fold(word)))
  ) {
    return addISODays(todayISO(now), 2);
  }
  if (
    includesTerm(text, "tomorrow") ||
    ["कल", "ਕੱਲ", "ਕੱਲ੍ਹ", "ਭਲਕੇ"].some((word) => tokens.includes(fold(word)))
  ) {
    return addISODays(todayISO(now), 1);
  }
  const folded = fold(text).replace(/(\d)(?:st|nd|rd|th)(?![a-z])/gi, "$1");

  const iso = folded.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const value = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return isISODate(value) ? value : null;
  }

  const numeric = folded.match(/(?<!\d)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?!\d)/);
  if (numeric) {
    const value = toISODate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    return isISODate(value) ? value : null;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const month = MONTHS[tokens[index]];
    if (!month) continue;
    const previous = numericToken(tokens[index - 1] ?? "");
    const next = numericToken(tokens[index + 1] ?? "");
    const day = previous && previous.value <= 31 ? previous.value : next && next.value <= 31 ? next.value : null;
    if (!day) continue;
    const yearToken = numericToken(tokens[index + (previous && previous.value <= 31 ? 1 : 2)] ?? "");
    const today = todayISO(now);
    const year = yearToken && yearToken.value > 1900 ? yearToken.value : Number(today.slice(0, 4));
    let value = toISODate(year, month, day);
    if (!isISODate(value)) return null;
    if (!yearToken && value < today) value = toISODate(year + 1, month, day);
    return value;
  }

  for (const token of tokens) {
    const weekday = WEEKDAY_NAMES[token];
    if (weekday == null) continue;
    return upcomingWeekday(weekday, now, text);
  }
  return null;
}

const WEEKDAY_NAMES: Record<string, number> = Object.fromEntries(
  (
    [
      ["sunday", 0],
      ["monday", 1],
      ["tuesday", 2],
      ["wednesday", 3],
      ["thursday", 4],
      ["friday", 5],
      ["saturday", 6],
      ["रविवार", 0],
      ["सोमवार", 1],
      ["मंगलवार", 2],
      ["बुधवार", 3],
      ["गुरुवार", 4],
      ["शुक्रवार", 5],
      ["शनिवार", 6],
      ["ਐਤਵਾਰ", 0],
      ["ਸੋਮਵਾਰ", 1],
      ["ਮੰਗਲਵਾਰ", 2],
      ["ਬੁੱਧਵਾਰ", 3],
      ["ਵੀਰਵਾਰ", 4],
      ["ਸ਼ੁੱਕਰਵਾਰ", 5],
      ["ਸ਼ਨੀਵਾਰ", 6],
    ] as const
  ).map(([name, day]) => [fold(name), day]),
);

function upcomingWeekday(target: number, now: Date, text: string): string {
  const today = todayISO(now);
  let delta = (target - weekdayIndex(today) + 7) % 7;
  if (delta === 0 && (includesTerm(text, "next") || text.includes("अगले") || text.includes("ਅਗਲੇ"))) delta = 7;
  return addISODays(today, delta);
}

export function questionAboutTrialEligibility(text: string): boolean {
  const question = /[?？]/.test(text) || /^(?:is|are|can|who|does|do|what|क्या|ਕੀ)\b/iu.test(text.trim());
  if (!question) return false;
  const trial = includesTerm(text, "trial") || includesTerm(text, "ट्रायल") || includesTerm(text, "ਟਰਾਇਲ");
  if (!trial) return false;
  const about =
    hasAny(text, ELIGIBILITY_TERMS) ||
    includesTerm(text, "class") ||
    includesTerm(text, "free") ||
    text.includes("क्लास") ||
    text.includes("कक्षा") ||
    text.includes("ਕਲਾਸ") ||
    text.includes("फ्री") ||
    text.includes("फ़्री") ||
    text.includes("ਫ੍ਰੀ");
  const commandsBooking =
    includesTerm(text, "book") || includesTerm(text, "sign up") || includesTerm(text, "बुक") || includesTerm(text, "ਬੁੱਕ");
  return about && !commandsBooking;
}

const SOCIAL_GREETINGS = new Set(
  [
    "hi",
    "hello",
    "hey",
    "namaste",
    "namaskar",
    "namaskaar",
    "नमस्ते",
    "नमस्कार",
    "हाय",
    "हैलो",
    "राम",
    "ਸਤ",
    "ਸ੍ਰੀ",
    "ਅਕਾਲ",
    "ਹੈਲੋ",
    "ਨਮਸਤੇ",
    "ਨਮਸਕਾਰ",
    "ji",
    "ਜੀ",
  ].map(fold),
);

function isPureGreeting(tokens: string[]): boolean {
  if (tokens.length === 0 || tokens.length > 6) return false;
  const norms = tokens.map(normToken);
  if (!norms.every((token) => GREETING_WORDS.has(token))) return false;
  const wishesDay = norms.includes("good") && norms.some((token) => token === "morning" || token === "evening");
  return norms.some((token) => SOCIAL_GREETINGS.has(token)) || wishesDay;
}

function asksIfConfirmed(text: string): boolean {
  const folded = fold(text);
  return (
    includesTerm(text, "booking confirmed") ||
    includesTerm(text, "is the booking confirmed") ||
    folded.includes("बुकिंग कन्फर्म") ||
    folded.includes("बुकिंग पक्की") ||
    folded.includes("ਬੁਕਿੰਗ ਪੱਕੀ")
  );
}

export function parseUtterance(text: string, now = new Date()): ParseResult {
  const prepared = text.replace(/(\d)\s*([ap]\.?m\.?)(?=[^a-z]|$)/gi, "$1 $2");
  const tokens = tokenize(prepared);
  if (isPureGreeting(tokens)) {
    return {
      intent: "greeting",
      courses: [],
      batch: null,
      period: null,
      time: null,
      partySize: null,
      phone: null,
      name: null,
      date: null,
      greeting: true,
    };
  }

  const courses = matchCourses(prepared);
  const { partySize, time } = scanQuantities(tokens);
  const period = periodFromTokens(tokens);
  const batch = batchFrom(period, time);
  const phone = extractPhone(prepared);
  const name = extractName(prepared);
  const date = extractDate(prepared, now);

  const askingPhone =
    hasAny(prepared, PHONE_ASK) &&
    !(phone && hasAny(prepared, ["my phone", "my number", "मेरा नंबर", "मेरा फोन", "ਮੇਰਾ ਨੰਬਰ", "ਮੇਰਾ ਫੋਨ"]));

  let intent: Intent = "unknown";
  if (questionAboutTrialEligibility(prepared)) intent = "eligibility";
  else if (asksIfConfirmed(prepared)) intent = "status";
  else if (hasAny(prepared, ELIGIBILITY_TERMS) && !hasAny(prepared, BOOK_VERBS)) intent = "eligibility";
  else if (hasAny(prepared, ADMISSION_TERMS) && !hasAny(prepared, BOOK_VERBS)) intent = "admission";
  else if (hasAny(prepared, BOOK_TERMS)) intent = "book";
  else if (hasAny(prepared, FEE_TERMS)) intent = "fees";
  else if (askingPhone) intent = "phone";
  else if (hasAny(prepared, BATCH_TERMS) || period || time) intent = "batches";
  else if (courses.length > 0) intent = "recommend";
  else if (hasAny(prepared, OFF_TOPIC)) intent = "off_topic";
  else if (partySize !== null) intent = "party";

  return {
    intent,
    courses,
    batch,
    period,
    time,
    partySize,
    phone,
    name,
    date,
    greeting: false,
  };
}
