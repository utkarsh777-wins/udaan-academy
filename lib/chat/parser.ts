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
  nameExplicit: boolean;
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

const MORNING = ["morning", "subah", "savera", "सुबह", "सवेरे", "सवेरा", "तड़के", "ਸਵੇਰ", "ਸਵੇਰੇ"].map(fold);
const AFTERNOON = ["afternoon", "dopahar", "दोपहर", "ਦੁਪਹਿਰ"].map(fold);
const EVENING = ["evening", "shaam", "sham", "शाम", "ਸ਼ਾਮ"].map(fold);
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

function textWithoutName(text: string, name: string | null): string {
  if (!name) return text;
  const source = text.normalize("NFC");
  const target = name.normalize("NFC");
  const at = source.toLowerCase().indexOf(target.toLowerCase());
  if (at < 0) return text;
  return `${source.slice(0, at)} ${source.slice(at + target.length)}`;
}

const BATCH_PARTICLES = new Set(
  ["ka", "ke", "ki", "kal", "wala", "instead", "the", "a", "please", "ji", "to", "का", "के", "की", "वाला", "कल", "ਦਾ", "ਦੇ", "ਦੀ", "ਵਾਲਾ"].map(fold),
);

export function mentionsBatchWord(text: string): boolean {
  return /\bbatch(?:es)?\b/i.test(text) || text.includes("बैच") || text.includes("ਬੈਚ");
}

function isBatchAnswer(text: string): boolean {
  if (mentionsBatchWord(text)) return true;
  const tokens = tokenize(text).map(fold);
  if (!tokens.some((token) => periodOf(token))) return false;
  return tokens.every((token) => periodOf(token) || BATCH_PARTICLES.has(token));
}

function peelPerson(name: string | null): string | null {
  if (!name) return null;
  const trailed = trailingNameAndPeriod(name);
  return trailed.name ?? name;
}

function stripNameLeads(value: string): string {
  let text = value.normalize("NFC").trim();
  const lead = /^(?:i'?m|i am|it'?s|it is|main|मैं|ਮੈਂ|name|naam|नाम|ਨਾਂ|ਨਾਮ)\s+/iu;
  let previous = "";
  while (text && text !== previous) {
    previous = text;
    text = text.replace(lead, "").trim();
  }
  return text;
}

function acceptName(value: string, allowMixed = false): string | null {
  return cleanName(stripNameLeads(value), allowMixed);
}

export function normalisePersonName(value: string, allowMixed = false): string | null {
  return peelPerson(acceptName(value, allowMixed));
}

function trailingNameAndPeriod(text: string): { name: string | null; period: DayPeriod | null } {
  const match = text
    .trim()
    .match(
      /^(.*?)(?:[,，]\s*|\s+)(morning|evening|afternoon|subah|dopahar|savera|shaam|sham|सुबह|दोपहर|शाम|ਸਵੇਰੇ?|ਦੁਪਹਿਰ|ਸ਼ਾਮ)(?:\s+(?:ka|ke|का|के|ਦਾ|ਦੇ|wala|वाला|ਵਾਲਾ))?(?:\s+(?:batch|बैच|ਬੈਚ))?$/iu,
    );
  if (!match) return { name: null, period: null };
  const prefix = match[1].replace(/[,，]\s*$/u, "").trim();
  const period = periodOf(match[2] ?? "");
  const name = prefix ? acceptName(prefix) : null;
  if (!name) return { name: null, period: null };
  return { name, period };
}

function resolvePeriod(text: string): DayPeriod | null {
  if (isBatchAnswer(text) || isBookingCommand(text)) return periodFromTokens(tokenize(text));
  const trailed = trailingNameAndPeriod(text).period;
  if (trailed) return trailed;
  const plain = text.trim().replace(/[।.!?]+$/u, "");
  if (isPersonName(plain) && !mentionsBatchWord(plain)) return null;
  return periodFromTokens(tokenize(text));
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

const NAME_META = new Set(
  [
    "correct",
    "correctly",
    "right",
    "perfect",
    "same",
    "ok",
    "okay",
    "fine",
    "wrong",
    "misspelled",
    "spelling",
    "spelt",
    "spelled",
    "already",
    "there",
    "now",
    "all",
    "absolutely",
    "exactly",
    "mine",
    "only",
    "yes",
    "no",
    "sahi",
    "theek",
    "सही",
    "ठीक",
    "गलत",
    "ਸਹੀ",
    "ਠੀਕ",
    "ਗਲਤ",
    "ही",
    "ਹੀ",
    "kya",
    "kaun",
    "what",
    "who",
    "क्या",
    "कौन",
    "ਕੀ",
    "ਕੌਣ",
  ].map(fold),
);

const NAME_PATTERNS: Array<{ pattern: RegExp; allowMixed: boolean }> = [
  { pattern: /my name is\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/iu, allowMixed: true },
  { pattern: /change (?:the )?name to\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/iu, allowMixed: false },
  { pattern: /the name is\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/iu, allowMixed: false },
  { pattern: /^(?:spelled|spelt)\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})$/iu, allowMixed: false },
  { pattern: /mera naam\s+(.+?)\s+hai\b/iu, allowMixed: false },
  { pattern: /मेरा नाम(?:\s+है)?\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u, allowMixed: false },
  { pattern: /^(?:नाम|name)\s*[:：]\s*([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})$/iu, allowMixed: true },
  { pattern: /ਮੇਰਾ ਨਾਂ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u, allowMixed: false },
  { pattern: /ਮੇਰਾ ਨਾਮ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})/u, allowMixed: false },
  { pattern: /^ਨਾਂ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})\s+ਹੈ$/u, allowMixed: false },
  { pattern: /^ਨਾਮ\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,40})\s+ਹੈ$/u, allowMixed: false },
];

export function explicitName(text: string): string | null {
  for (const part of text.split(/[.?!।]+/u)) {
    const source = part.normalize("NFC").trim();
    if (!source) continue;
    for (const { pattern, allowMixed } of NAME_PATTERNS) {
      const match = source.match(pattern);
      if (!match) continue;
      const name = normalisePersonName(match[1] ?? "", allowMixed);
      if (name) return name;
    }
  }
  return null;
}

function fillOnlyName(text: string): string | null {
  const source = text.normalize("NFC").trim();
  const patterns = [
    /^(?:i'?m|i am)\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})$/iu,
    /^(?:मैं|main)\s+(.+?)\s+(?:हूँ|हूं|हैं)$/u,
    /^ਮੈਂ\s+(.+?)\s+ਹਾਂ$/u,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const name = normalisePersonName(match[1] ?? "");
    if (name) return name;
  }
  return null;
}

function extractName(text: string): { name: string | null; explicit: boolean } {
  const stated = explicitName(text);
  if (stated) return { name: stated, explicit: true };
  return { name: fillOnlyName(text) ?? nameBesidePhone(text), explicit: false };
}

function nameBesidePhone(source: string): string | null {
  const folded = fold(source);
  const match = folded.match(/(?<!\d)(?:\+?91[\s-]*|0)?[6-9](?:[\s-]*\d){9}(?!\d)/);
  if (!match || match.index == null) return null;
  const before = source.slice(0, match.index);
  const segment = (before.split(/[।.!?]/u).at(-1) ?? before).replace(/[,，:：]\s*$/u, "").trim();
  if (segment && segment.split(/\s+/).length <= 4) {
    const direct = normalisePersonName(segment);
    if (direct) return direct;
  }
  const introduced = before.match(
    /\bfor\s+([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60}?)(?=\s*(?:,\s*)?(?:phone|ph|फोन|ਫੋਨ|नंबर|ਨੰਬਰ)\b|\s*,|\s+\d)/iu,
  );
  return introduced ? normalisePersonName(introduced[1] ?? "") : null;
}

const NAME_FILLERS = new Set(["now", "already", "actually", "just", "please", "ji", "जी", "ਜੀ", "plz", "अब", "ਹੁਣ"].map(fold));

const NAME_JUNK = new Set(
  ["thanks", "thank", "thanku", "given", "here", "before", "plus", "hold", "on", "batch", "weekend", "as", "minute"].map(fold),
);

function stripNameFillers(value: string): string {
  return value
    .split(/\s+/)
    .filter((word) => word && !NAME_FILLERS.has(fold(word)))
    .join(" ");
}

function tidyName(value: string): string {
  const cut = value.split(/[।?!]|\s+(?:and|aur|ਅਤੇ|phone|फोन|ਫੋਨ|,)/i)[0] ?? value;
  return stripNameFillers(
    cut
      .replace(/[।.!?]+$/g, "")
      .replace(/^(?:spelled|spelt)\s+/i, "")
      .replace(/(?:\s+(?:है|हैं|हूँ|हूं|जी|hai|ਹੈ|ਹਾਂ|ਜੀ))+$/iu, "")
      .replace(/(?:\s+(?:only|ही|ਹੀ))+$/iu, "")
      .trim(),
  );
}

function cleanName(value: string, allowMixed = false): string | null {
  const name = tidyName(value);
  if (!name) return null;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.some((word) => NAME_JUNK.has(fold(word)))) return null;
  const metas = words.filter((word) => NAME_META.has(fold(word)));
  if (metas.length === words.length) return null;
  if (metas.length > 0) {
    if (!(allowMixed && words.length >= 2)) return null;
    return name;
  }
  if (!isPersonName(name)) return null;
  return name;
}

const NAME_CONFIRM = new Set(
  [
    "correct",
    "correctly",
    "right",
    "perfect",
    "fine",
    "ok",
    "okay",
    "same",
    "mine",
    "sahi",
    "theek",
    "सही",
    "ठीक",
    "ਸਹੀ",
    "ਠੀਕ",
    "already",
    "there",
    "now",
    "all",
    "absolutely",
    "exactly",
    "spelling",
    "spelt",
    "spelled",
    "only",
    "yes",
    "ही",
    "ਹੀ",
  ].map(fold),
);

const NAME_REJECT = new Set(
  ["wrong", "misspelled", "गलत", "ਗਲਤ", "kya", "kaun", "what", "who", "क्या", "कौन", "ਕੀ", "ਕੌਣ"].map(fold),
);

function flattenMessage(text: string): string {
  return text.normalize("NFC").replace(/[.?!।,，]+/g, " ").replace(/\s+/g, " ").trim();
}

function isNameChangeCommand(text: string): boolean {
  return (
    /change\s+(?:the\s+)?name\s+to\b/iu.test(text) ||
    /(?:नाम|ਨਾਮ|ਨਾਂ).{0,16}(?:बदल|ਬਦਲ)|(?:बदल|ਬਦਲ).{0,24}(?:नाम|ਨਾਮ|ਨਾਂ)/u.test(text)
  );
}

const NAME_LEAD =
  /^(?:the name is|my name is|mera naam|मेरा नाम(?:\s+है)?|ਮੇਰਾ ਨਾਂ|ਮੇਰਾ ਨਾਮ|(?:name|नाम)\s*[:：])\s+/iu;

const NAME_WRONG = new Set(["wrong", "misspelled", "galat", "incorrect", "गलत", "ਗਲਤ"].map(fold));

function confirmWords(value: string): string[] {
  const trimmed = stripNameFillers(
    value
      .replace(/^(?:spelled|spelt)\s+/i, "")
      .replace(/(?:\s+(?:है|हैं|हूँ|हूं|जी|hai|ਹੈ|ਹਾਂ|ਜੀ))+$/iu, "")
      .replace(/(?:\s+(?:only|ही|ਹੀ))+$/iu, "")
      .trim(),
  );
  return trimmed.split(/\s+/).filter(Boolean);
}

export function explicitMetaOnly(text: string): boolean {
  return explicitConfirmation(text);
}

const LONE_NOT_YES = new Set(["spelling", "only", "there", "all", "mine"].map(fold));

const EXTRA_YES = new Set(
  ["looks good", "all good", "that is correct", "that is right", "सब सही है", "सब सही", "sab sahi", "sab sahi hai", "ਸਭ ਸਹੀ ਹੈ", "ਸਭ ਸਹੀ"].map((phrase) => fold(phrase)),
);

export function isLoneWeakConfirm(text: string): boolean {
  const words = confirmWords(flattenMessage(text));
  return words.length === 1 && LONE_NOT_YES.has(fold(words[0] ?? ""));
}

export function explicitConfirmation(text: string): boolean {
  if (/[?？]/.test(text) || isNameChangeCommand(text) || isLoneWeakConfirm(text)) return false;
  const flat = flattenMessage(text);
  if (!flat) return false;
  if (EXTRA_YES.has(fold(flat))) return true;
  const bare = confirmWords(flat);
  if (bare.length > 0 && bare.every((word) => NAME_CONFIRM.has(fold(word)))) return true;
  if (!NAME_LEAD.test(flat)) return false;
  const rest = confirmWords(flat.replace(NAME_LEAD, ""));
  if (rest.length === 0 || rest.some((word) => NAME_WRONG.has(fold(word)) || NAME_REJECT.has(fold(word)))) return false;
  return rest.every((word) => NAME_CONFIRM.has(fold(word)));
}

const BARE_WRONG = new Set(["wrong", "galat", "गलत", "ਗਲਤ"].map(fold));

const NAME_WRONG_LEAD =
  /^(?:the name is|my name is|mera naam|मेरा नाम(?:\s+है)?|नाम|ਮੇਰਾ ਨਾਂ|ਮੇਰਾ ਨਾਮ|ਨਾਂ|ਨਾਮ)\s+/iu;

export function isBareWrong(text: string): boolean {
  const words = confirmWords(flattenMessage(text));
  return words.length === 1 && BARE_WRONG.has(fold(words[0] ?? ""));
}

export function explicitNameRejection(text: string): boolean {
  if (isNameChangeCommand(text) || isBareWrong(text)) return false;
  const flat = flattenMessage(text);
  const source = NAME_WRONG_LEAD.test(flat) ? flat.replace(NAME_WRONG_LEAD, "") : NAME_LEAD.test(flat) ? flat.replace(NAME_LEAD, "") : flat;
  const words = confirmWords(source);
  if (words.length === 0) return false;
  const joined = words.map((word) => fold(word)).join(" ");
  if (joined === "not right" || joined === "not correct") return true;
  if (!NAME_WRONG_LEAD.test(flat) && !NAME_LEAD.test(flat) && words.length === 1 && !NAME_WRONG.has(fold(words[0] ?? ""))) return false;
  if (!NAME_WRONG_LEAD.test(flat) && !NAME_LEAD.test(flat)) {
    return words.every((word) => NAME_WRONG.has(fold(word)));
  }
  return words.every((word) => NAME_WRONG.has(fold(word)));
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
    "पापा का नंबर",
    "ਮੇਰੇ ਪੁੱਤ ਦਾ",
    "आगे बढ़ो",
    "आगे बढ़िए",
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
    "weekend",
    "tomorrow",
    "today",
    "please",
    "yes",
    "no",
    "ok",
    "okay",
    "hi",
    "hello",
    "hey",
    "namaste",
    "namaskar",
    "trial",
    "हाँ",
    "हां",
    "नहीं",
    "कल",
    "आज",
    "बजे",
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
    "at",
    "me",
    "my",
    "call",
    "number",
    "is",
    "a",
    "an",
    "please",
    "thanks",
    "thank",
    "you",
    "to",
    "of",
    "or",
    "son",
    "daughter",
    "brother",
    "sister",
    "wife",
    "husband",
    "father",
    "mother",
    "friend",
    "kindly",
    "sir",
    "madam",
    "phagwara",
    "jalandhar",
    "ludhiana",
    "amritsar",
    "chandigarh",
    "delhi",
    "mohali",
    "hoshiarpur",
    "kapurthala",
    "patiala",
    "bathinda",
    "करना",
    "कर",
    "दो",
    "मेरा",
    "मेरी",
    "मेरे",
    "कृपया",
    "धन्यवाद",
    "बेटा",
    "फगवाड़ा",
    "जालंधर",
    "लुधियाना",
    "अमृतसर",
    "का",
    "नंबर",
    "नम्बर",
    "ਕਰੋ",
    "ਕਰ",
    "ਦੋ",
    "ਜੀ",
    "ਮੇਰਾ",
    "ਮੇਰੀ",
    "ਫਗਵਾੜਾ",
    "ਜਲੰਧਰ",
    "ਲੁਧਿਆਣਾ",
    "ਧੰਨਵਾਦ",
    "ਸ਼ੁਕਰੀਆ",
    "ਮਿਹਰਬਾਨੀ",
    "ਕਿਰਪਾ",
    "ਮੇਰੇ",
    "ਦਾ",
    "dhannvaad",
    "shukriya",
    "thanku",
    "ready",
    "fine",
    "good",
    "given",
    "hold",
    "before",
    "plus",
    "here",
    "busy",
    "free",
    "kya",
    "kaun",
    "तैयार",
    "ਤਿਆਰ",
    "करो",
    "कैंसल",
    "कैंसिल",
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
  const titles = new Set(
    [
      "papa",
      "mummy",
      "mom",
      "dad",
      "beta",
      "bhai",
      "uncle",
      "aunty",
      "पापा",
      "मम्मी",
      "नाना",
      "नानी",
      "दादा",
      "ਪਾਪਾ",
      "ਮੰਮੀ",
      "ਬੇਟਾ",
      "ਭਾਈ",
      "ਪੁੱਤ",
      "ਮਾਤਾ",
      "ਪਿਤਾ",
    ].map(fold),
  );
  if (/^(?:one|ek)\s+(?:minutes?|secs?|seconds?)$/i.test(fold(name))) return false;
  if (mentionsBatchWord(name)) return false;
  if (words.some((word) => blocked.has(fold(word)) || RESERVED_NAMES.has(fold(word)))) return false;
  const honorifics = new Set(["ji", "जी", "ਜੀ"].map(fold));
  const particles = new Set(["ka", "ke", "ki", "ko", "nu", "da", "de", "di", "wala", "का", "के", "की", "को", "वाला", "ਦਾ", "ਦੇ", "ਦੀ", "ਨੂੰ", "ਵਾਲਾ"].map(fold));
  const timeOfDay = new Set([...MORNING, ...AFTERNOON, ...EVENING, ...NIGHT, ...WEEKEND]);
  const given = words.filter(
    (word) => !titles.has(fold(word)) && !honorifics.has(fold(word)) && !timeOfDay.has(fold(word)) && !particles.has(fold(word)),
  );
  return given.length > 0;
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

  const weekday = weekdayFromPositiveClauses(text);
  if (weekday == null) return null;
  return upcomingWeekday(weekday, now, text);
}

function clauseNegatesDay(clause: string): boolean {
  const folded = fold(clause);
  return (
    /\b(?:busy|unable)\b/.test(folded) ||
    /\bnot\b/.test(folded) ||
    /\bnot free\b/.test(folded) ||
    /\b(?:can't|cannot|cant)\b/.test(folded) ||
    folded.includes("व्यस्त") ||
    folded.includes("ਵਿਅਸਤ")
  );
}

function weekdayFromPositiveClauses(text: string): number | null {
  const kept = text.split(/[,;]|\bbut\b|\bso\b|तो|ਤਾਂ/iu).filter((part) => part.trim() && !clauseNegatesDay(part));
  if (kept.length === 0) return null;
  return weekdayForBooking(tokenize(kept.join(" ")).map((token) => fold(token)));
}

const BOOKING_VERBS = new Set(
  ["book", "booking", "trial", "attend", "signup", "बुक", "ट्रायल", "ਬੁੱਕ", "ਟਰਾਇਲ"].map(fold),
);

function weekdayForBooking(tokens: string[]): number | null {
  const hits: { index: number; day: number }[] = [];
  const verbs: number[] = [];
  tokens.forEach((token, index) => {
    const day = WEEKDAY_NAMES[token];
    if (day != null) hits.push({ index, day });
    if (BOOKING_VERBS.has(token)) verbs.push(index);
  });
  if (hits.length === 0) return null;
  if (verbs.length === 0) return hits[hits.length - 1].day;
  const anchor = Math.min(...verbs);
  const after = hits.filter((hit) => hit.index > anchor);
  const pool = after.length > 0 ? after : hits;
  let best = pool[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hit of pool) {
    const distance = Math.min(...verbs.map((verb) => Math.abs(verb - hit.index)));
    if (distance < bestDistance || (distance === bestDistance && hit.index >= best.index)) {
      best = hit;
      bestDistance = distance;
    }
  }
  return best.day;
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

export function classYear(text: string): number | null {
  const folded = fold(text);
  const labeled = folded.match(/(?:classes|class|क्लास|कक्षा|ਕਲਾਸ)\s*(8|9|10|11|12)(?!\d)/u);
  if (labeled) return Number(labeled[1]);
  const ordinal = folded.match(/(?:^|[^\d])(8|9|10|11|12)\s*(?:th|वीं|ਵੀਂ)(?!\p{L})/u);
  if (ordinal) return Number(ordinal[1]);
  return null;
}

export function isBookingCommand(text: string): boolean {
  return hasAny(text, ["book", "booking", "sign up", "attend", "बुक", "बुकिंग", "ਬੁੱਕ"]);
}

export function isStaffQuestion(text: string): boolean {
  return hasAny(text, [
    "who teaches",
    "who is teaching",
    "teacher",
    "teachers",
    "faculty",
    "कौन पढ़ाता",
    "कौन पढ़ाते",
    "शिक्षक",
    "ਕੌਣ ਪੜ੍ਹਾਉਂਦਾ",
    "ਅਧਿਆਪਕ",
  ]);
}

export function isTimingQuestion(text: string): boolean {
  const question = /[?？]/.test(text) || /^(?:what|when|which|कब|ਕਦੋਂ)\b/iu.test(text.trim());
  if (!question) return false;
  return hasAny(text, ["what time", "when is", "timing", "timings", "schedule", "which batch", "कब", "टाइम", "ਸਮਾਂ", "ਕਦੋਂ"]);
}

function mentionsTrial(text: string): boolean {
  return includesTerm(text, "trial") || includesTerm(text, "ट्रायल") || includesTerm(text, "ਟਰਾਇਲ");
}

function mentionsFree(text: string): boolean {
  return includesTerm(text, "free") || text.includes("फ्री") || text.includes("फ़्री") || text.includes("ਫ੍ਰੀ");
}

const WEEKDAY_WORDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "सोमवार",
  "मंगलवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
  "रविवार",
  "ਸੋਮਵਾਰ",
  "ਮੰਗਲਵਾਰ",
  "ਬੁੱਧਵਾਰ",
  "ਵੀਰਵਾਰ",
  "ਸ਼ੁੱਕਰਵਾਰ",
  "ਸ਼ਨੀਵਾਰ",
  "ਐਤਵਾਰ",
];

export function hasWeekday(text: string): boolean {
  return hasAny(text, WEEKDAY_WORDS);
}

export function isDurationQuestion(text: string): boolean {
  return hasAny(text, ["how long", "how much time", "कितनी देर", "कितना लंबा", "ਕਿੰਨੀ ਦੇਰ"]);
}

export function isOnlineQuestion(text: string): boolean {
  if (!mentionsTrial(text)) return false;
  const question = /[?？]/.test(text) || /^(?:is|are|can|does|do|क्या|ਕੀ)\b/iu.test(text.trim());
  if (!question) return false;
  return hasAny(text, ["online", "on line"]) || text.includes("ऑनलाइन") || text.includes("ਔਨਲਾਈਨ");
}

export function isQuestionForm(text: string): boolean {
  if (/[?？]/.test(text)) return true;
  const folded = text.normalize("NFC").trim().toLowerCase();
  if (/^(?:do not|don't|dont)\b/u.test(folded)) return false;
  if (/^(?:is|are|does|do|what|when|which|how|kya)\b/u.test(folded)) return true;
  return /क्या|कब|ਕੀ|ਕਦੋਂ/u.test(text);
}

export function isTrialContentQuestion(text: string): boolean {
  return mentionsTrial(text) && (hasAny(text, ["what happens", "what do you do", "what is in"]) || text.includes("क्या होता") || text.includes("ਕੀ ਹੁੰਦਾ"));
}

export function isTrialQuestion(text: string): boolean {
  if (!mentionsTrial(text) || isBookingCommand(text) || isOnlineQuestion(text) || isDurationQuestion(text)) return false;
  return /[?？]/.test(text) || /^(?:is|are|can|does|do|what|when|which|how|क्या|कब|ਕੀ|ਕਦੋਂ)\b/iu.test(text.trim());
}

export function isTrialInfoQuestion(text: string): boolean {
  if (!mentionsTrial(text) || isStaffQuestion(text)) return false;
  const question = /[?？]/.test(text) || /^(?:can|is|are|how|what|does|do|क्या|ਕੀ)\b/iu.test(text.trim());
  if (!question) return false;
  if (isDurationQuestion(text)) return false;
  if (hasWeekday(text) && isBookingCommand(text)) return false;
  if (classYear(text) != null) return true;
  return mentionsFree(text);
}

export function questionAboutTrialEligibility(text: string): boolean {
  if (isStaffQuestion(text) || isTimingQuestion(text) || isBookingCommand(text)) return false;
  const year = classYear(text);
  if (year == null) return false;
  return mentionsTrial(text) || mentionsFree(text) || hasAny(text, ELIGIBILITY_TERMS);
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
      nameExplicit: false,
      date: null,
      greeting: true,
    };
  }

  const courses = matchCourses(prepared);
  const { partySize, time } = scanQuantities(tokens);
  const phone = extractPhone(prepared);
  const named = extractName(prepared);
  const trailed = trailingNameAndPeriod(prepared);
  const resolvedName = named.name ?? trailed.name;
  const period = resolvePeriod(textWithoutName(prepared, resolvedName));
  const batch = batchFrom(period, resolvedName ? null : time);
  const date = extractDate(prepared, now);

  const askingPhone = !phone && hasAny(prepared, PHONE_ASK);

  let intent: Intent = "unknown";
  if (isStaffQuestion(prepared) && !isBookingCommand(prepared)) intent = "unknown";
  else if (isOnlineQuestion(prepared) || (isDurationQuestion(prepared) && mentionsTrial(prepared))) intent = "unknown";
  else if (isTrialInfoQuestion(prepared) || questionAboutTrialEligibility(prepared)) intent = "eligibility";
  else if (asksIfConfirmed(prepared)) intent = "status";
  else if (hasAny(prepared, ELIGIBILITY_TERMS) && !hasAny(prepared, BOOK_VERBS) && !isBookingCommand(prepared) && !isStaffQuestion(prepared)) intent = "eligibility";
  else if (hasAny(prepared, ADMISSION_TERMS) && !hasAny(prepared, BOOK_VERBS) && !isBookingCommand(prepared)) intent = "admission";
  else if (isTrialQuestion(prepared)) intent = "batches";
  else if (isTimingQuestion(prepared) && !isBookingCommand(prepared)) intent = "batches";
  else if ((hasAny(prepared, BOOK_TERMS) || isBookingCommand(prepared)) && !isTrialInfoQuestion(prepared) && !isTrialQuestion(prepared)) intent = "book";
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
    name: resolvedName,
    nameExplicit: named.explicit || Boolean(trailed.name),
    date,
    greeting: false,
  };
}
