import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import { POST as postChat } from "@/app/api/chat/route";
import { listBookings, resetMemoryAttemptsForTests } from "@/lib/bookings";
import { counsel, type Draft } from "@/lib/chat/respond";

const now = new Date("2026-10-31T08:00:00.000Z");
const phone = "9876543210";
const languages = ["en", "hi", "pa"] as const;

const ask = {
  name: /name|नाम|ਨਾਮ|ਨਾਂ/i,
  phone: /phone|फ़ोन|फोन|ਫੋਨ/i,
  batch: /batch|बैच|ਬੈਚ/i,
  date: /date|तारीख|ਤਾਰੀਖ/i,
  send: /send|भेज|ਭੇਜ/i,
  sending: /sending|भेज रही|ਭੇਜ ਰਹੀ/,
  stopped: /stopped|nothing|रोक|ਰੋਕ|ਨਹੀਂ/i,
  wrong: /which part is wrong|कौन सी बात गलत|ਕਿਹੜੀ ਗੱਲ ਗਲਤ/i,
  correctName: /correct name|सही नाम|ਸਹੀ ਨਾਂ/i,
  change: /which part should I change|क्या बदलना|ਕੀ ਬਦਲਣਾ/i,
  window: /45/,
  neet: /neet/i,
  online: /online|ऑनलाइन|ਔਨਲਾਈਨ/i,
  fee: /fee|फ़ीस|फीस|ਫੀਸ/i,
};

const bases = {
  name: { active: true, course: "ielts-pte" } satisfies Draft,
  phone: { active: true, name: "Simran", course: "ielts-pte" } satisfies Draft,
  batch: { active: true, name: "Simran", phone, course: "ielts-pte" } satisfies Draft,
  date: { active: true, name: "Simran", phone, course: "ielts-pte", batch: "morning" as const } satisfies Draft,
  confirm: {
    active: true,
    confirming: true,
    name: "Simran",
    phone,
    course: "ielts-pte",
    batch: "morning" as const,
    date: "2026-11-20",
  } satisfies Draft,
  rename: {
    active: true,
    confirming: true,
    name: "Simran",
    phone,
    course: "ielts-pte",
    batch: "morning" as const,
    date: "2026-11-20",
    pendingName: "Aman Gill",
  } satisfies Draft,
  mid: {
    active: true,
    name: "Simran",
    phone,
    course: "ielts-pte",
    batch: "morning" as const,
    pendingName: "Aman Gill",
  } satisfies Draft,
};

type Step = keyof typeof bases;
type Row = {
  step: Step;
  text: string;
  name: string | null;
  phone: string | null;
  date: string | null;
  batch: "morning" | "evening" | "weekend" | null;
  sent: boolean;
  next: RegExp;
  questions: number;
  pending?: string | null;
  course?: string;
};

const kept = {
  name: "Simran" as string | null,
  phone: phone as string | null,
  date: "2026-11-20" as string | null,
  batch: "morning" as const,
};

const rows: Row[] = [
  { step: "name", text: "Sham Singh", name: "Sham Singh", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "Sham Lal", name: "Sham Lal", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "Sham Sundar", name: "Sham Sundar", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "शाम लाल", name: "शाम लाल", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "ਸ਼ਾਮ ਲਾਲ", name: "ਸ਼ਾਮ ਲਾਲ", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "मेरा नाम शाम लाल है", name: "शाम लाल", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "my name is Sham Lal", name: "Sham Lal", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "I am Sham Sundar", name: "Sham Sundar", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "Simran morning", name: "Simran", phone: null, date: null, batch: "morning", sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "Simran, evening batch", name: "Simran", phone: null, date: null, batch: "evening", sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "I am Simran, morning batch", name: "Simran", phone: null, date: null, batch: "morning", sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "main Simran", name: "Simran", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "मैं सिमरन", name: "सिमरन", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "ਮੈਂ ਸਿਮਰਨ", name: "ਸਿਮਰਨ", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "it's Simran", name: "Simran", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "name Simran", name: "Simran", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "Simran ji", name: "Simran", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "सिमरन, शाम का बैच", name: "सिमरन", phone: null, date: null, batch: "evening", sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "ਸਿਮਰਨ, ਸ਼ਾਮ ਦਾ ਬੈਚ", name: "ਸਿਮਰਨ", phone: null, date: null, batch: "evening", sent: false, next: ask.phone, questions: 1 },
  { step: "name", text: "evening batch", name: null, phone: null, date: null, batch: "evening", sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "one sec", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "one minute", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "hello", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "hi", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "namaste", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "I am ready", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "name", text: "I am fine", name: null, phone: null, date: null, batch: null, sent: false, next: ask.name, questions: 1 },
  { step: "phone", text: "9876543210", name: "Simran", phone, date: null, batch: null, sent: false, next: ask.batch, questions: 1 },
  { step: "phone", text: "1234567890", name: "Simran", phone: null, date: null, batch: null, sent: false, next: ask.phone, questions: 1 },
  { step: "phone", text: "change phone to 9876501234", name: "Simran", phone: "9876501234", date: null, batch: null, sent: false, next: ask.batch, questions: 1 },
  { step: "batch", text: "evening batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1 },
  { step: "batch", text: "morning batch", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.date, questions: 1 },
  { step: "batch", text: "shaam ka batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1 },
  { step: "batch", text: "kal shaam", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1 },
  { step: "batch", text: "evening", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1 },
  { step: "batch", text: "सुबह", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.date, questions: 1 },
  { step: "date", text: "3 November", name: "Simran", phone, date: "2026-11-03", batch: "morning", sent: false, next: ask.send, questions: 1 },
  { step: "date", text: "३ नवंबर", name: "Simran", phone, date: "2026-11-03", batch: "morning", sent: false, next: ask.send, questions: 1 },
  { step: "date", text: "not Monday, Tuesday", name: "Simran", phone, date: "2026-11-03", batch: "morning", sent: false, next: ask.send, questions: 1 },
  { step: "date", text: "Monday is not a problem", name: "Simran", phone, date: "2026-11-02", batch: "morning", sent: false, next: ask.send, questions: 1 },
  { step: "date", text: "20 December", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.window, questions: 0 },
  { step: "date", text: "evening batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1 },
  { step: "date", text: "change phone to 9876501234", name: "Simran", phone: "9876501234", date: null, batch: "morning", sent: false, next: ask.date, questions: 1 },
  { step: "date", text: "Is the NEET trial class on Saturday?", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.neet, questions: 1 },
  { step: "date", text: "wrong", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.wrong, questions: 1 },
  { step: "confirm", text: "evening batch", name: "Simran", phone, date: "2026-11-20", batch: "evening", sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "evening instead", name: "Simran", phone, date: "2026-11-20", batch: "evening", sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "morning", ...kept, sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "morning batch", ...kept, sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "सुबह", ...kept, sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "ਸਵੇਰ", ...kept, sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "NEET instead", ...kept, course: "neet-foundation", sent: false, next: ask.send, questions: 1 },
  { step: "confirm", text: "the name is correct", ...kept, sent: true, next: ask.sending, questions: 0 },
  { step: "confirm", text: "I am ready", ...kept, sent: true, next: ask.sending, questions: 0 },
  { step: "confirm", text: "I am fine", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "confirm", text: "yes please", ...kept, sent: true, next: ask.sending, questions: 0 },
  { step: "confirm", text: "the name is wrong", name: null, phone, date: "2026-11-20", batch: "morning", sent: false, next: ask.correctName, questions: 1 },
  { step: "confirm", text: "my name is now Aman Gill", ...kept, sent: false, next: /Aman Gill/, questions: 1, pending: "Aman Gill" },
  { step: "confirm", text: "ਸਭ ਸਹੀ ਹੈ", ...kept, sent: true, next: ask.sending, questions: 0 },
  { step: "confirm", text: "cancel", name: null, phone: null, date: null, batch: null, sent: false, next: ask.stopped, questions: 0 },
  { step: "confirm", text: "correct, cancel", name: null, phone: null, date: null, batch: null, sent: false, next: ask.stopped, questions: 0 },
  { step: "confirm", text: "ruko mat, cancel", name: null, phone: null, date: null, batch: null, sent: false, next: ask.stopped, questions: 0 },
  { step: "confirm", text: "stop and think", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "confirm", text: "don't cancel", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "confirm", text: "ruko", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "confirm", text: "रुको", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "confirm", text: "ਰੁਕੋ", ...kept, sent: false, next: ask.change, questions: 1 },
  { step: "rename", text: "correct", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "सही", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "ਸਹੀ", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "yes please", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no thanks", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no, correct", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nhi, sahi hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "Na, sahi hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nai, theek hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "naa, theek hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "Not needed, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "dont change, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "don't change, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "naah, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "dont, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nko, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "mat badlo, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "मत बदलो, सही है", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "ਨਾ ਬਦਲੋ, ਸਹੀ ਹੈ", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nope, correct", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nahi, sahi hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "nahin, sahi hai", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no, same", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no, fine", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no, ok", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "नहीं, सही है", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "ना, सही है", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "ਨਹੀਂ, ਸਹੀ ਹੈ", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "ਨਾ, ਸਹੀ ਹੈ", ...kept, sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "no, evening batch", name: "Simran", phone, date: "2026-11-20", batch: "evening", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "correct, evening batch", name: "Aman Gill", phone, date: "2026-11-20", batch: "evening", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "correct and evening batch", name: "Aman Gill", phone, date: "2026-11-20", batch: "evening", sent: false, next: ask.send, questions: 1, pending: null },
  { step: "rename", text: "correct, cancel", name: null, phone: null, date: null, batch: null, sent: false, next: ask.stopped, questions: 0 },
  { step: "rename", text: "Is the trial online?", ...kept, sent: false, next: ask.online, questions: 1, pending: "Aman Gill" },
  { step: "mid", text: "no, correct", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.date, questions: 1, pending: null },
  { step: "mid", text: "no, evening batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: ask.date, questions: 1, pending: null },
  { step: "mid", text: "नहीं, सही है", name: "Simran", phone, date: null, batch: "morning", sent: false, next: ask.date, questions: 1, pending: null },
];

const PEOPLE = [
  "Sham Singh",
  "Sham Lal",
  "Sham Sundar",
  "शाम लाल",
  "ਸ਼ਾਮ ਲਾਲ",
  "Subah Kaur",
  "Savera Singh",
  "Sandhya Sharma",
  "Simran",
  "Simran Kaur",
  "Aman Gill",
  "Navjot Kaur",
  "Jitesh Kumar",
  "Karan Singh",
  "Papa Singh",
  "Harman Kaur",
  "Mina Kaur",
];

function captureTexts(name: string): string[] {
  const introduced = /[\u0900-\u097F]/.test(name)
    ? `मेरा नाम ${name} है`
    : /[\u0A00-\u0A7F]/.test(name)
      ? `ਮੇਰਾ ਨਾਂ ${name} ਹੈ`
      : `mera naam ${name} hai`;
  return [
    name,
    `my name is ${name}`,
    `for ${name}, phone ${phone}`,
    `for ${name} phone ${phone}`,
    `I am ${name}`,
    `name: ${name}`,
    introduced,
  ];
}

const JUNK = [
  "thanks",
  "thank",
  "thanku",
  "thank you",
  "given",
  "here",
  "before",
  "plus",
  "hold",
  "hold on",
  "on",
  "as",
  "minute",
  "batch",
  "weekend",
  "one sec",
  "one minute",
  "one second",
  "hello",
  "hi",
  "hey",
  "namaste",
  "namaskar",
];

const CANCELS = [
  "cancel",
  "Cancel.",
  "cancel!",
  "cancel it",
  "cancel this",
  "please cancel",
  "cancel the booking",
  "cancel my booking",
  "cancel the trial",
  "cancel the request",
  "I want to cancel",
  "I would like to cancel",
  "no, cancel",
  "just cancel",
  "ok cancel",
  "actually cancel",
  "yes cancel",
  "all correct and cancel",
  "correct\ncancel",
  "ruko mat, cancel",
  "stop",
  "stop it",
  "rehne do",
  "रहने दो",
  "never mind",
  "nevermind",
  "forget it",
  "cancel please",
  "रद्द",
  "रद्द करो",
  "रद्द कर दीजिए",
  "कैंसल करो",
  "कैंसिल कर दो",
  "छोड़ो",
  "छोड़ दो",
  "ਰੱਦ ਕਰੋ",
  "ਬੁਕਿੰਗ ਰੱਦ ਕਰੋ",
  "ਕੈਂਸਲ ਕਰੋ",
];

const GUARDS = [
  "don't cancel",
  "don't cancel the trial",
  "dont cancel",
  "do not cancel",
  "don't stop",
  "don't stop go ahead",
  "no need to cancel",
  "not cancel",
  "please don't cancel",
  "please do not cancel",
  "do not stop",
  "don't cancel it",
  "don't cancel the booking",
  "don't cancel my booking",
  "never cancel",
  "mat cancel",
  "मत रद्द करो",
  "रद्द मत करो",
  "नहीं रद्द करो",
  "ਰੱਦ ਨਾ ਕਰੋ",
  "Is there a cancellation fee?",
  "Which bus stop is nearest?",
  "what if I need to cancel later?",
  "can I cancel later?",
  "What is the IELTS fee?",
  "Is the trial online?",
  "How long is the trial?",
  "Who teaches IELTS?",
  "What happens in the trial?",
  "Is the trial free?",
  "Where is the centre?",
  "What is the address?",
  "Do you have a weekend batch?",
  "When is the morning batch?",
  "How much is NEET?",
  "Can I visit the centre?",
  "Is parking available?",
  "What is spoken English?",
  "Which course is for class 10?",
  "Do you teach Punjabi?",
  "What are the fees?",
  "Is there a night batch?",
  "Can the trial be online?",
  "Why is the fee this much?",
  "stop and think",
  "hello",
  "hi",
  "namaste",
  "hey",
  "namaskar",
  "not now",
  "ruko",
  "रुको",
  "रुकिए",
  "ਰੁਕੋ",
  "wait",
  "one sec",
  "one minute",
  "hold on",
  "ek minute",
  "thanks",
  "thank you",
  "maybe",
  "not sure",
  "perhaps",
  "let me think",
  "see you tomorrow",
];

function questionsIn(reply: string): number {
  return reply.match(/\?/g)?.length ?? 0;
}

describe("round 8–17 regression corpus", () => {
  it.each(rows.flatMap((row) => languages.map((language) => ({ ...row, language }))))(
    "$language $step: $text",
    (row) => {
      const result = counsel({ text: row.text, language: row.language, draft: bases[row.step], now });
      expect(result.ready, row.text).toBe(row.sent);
      expect(result.draft.name ?? null, row.text).toBe(row.name);
      expect(result.draft.phone ?? null, row.text).toBe(row.phone);
      expect(result.draft.date ?? null, row.text).toBe(row.date);
      expect(result.draft.batch ?? null, row.text).toBe(row.batch);
      if (row.pending !== undefined) expect(result.draft.pendingName ?? null, row.text).toBe(row.pending);
      if (row.course) expect(result.draft.course, row.text).toBe(row.course);
      expect(result.reply, row.text).toMatch(row.next);
      expect(questionsIn(result.reply), result.reply).toBe(row.questions);
    },
  );

  it.each(languages)("fills a one-line booking in %s", (language) => {
    const result = counsel({
      text: "my name is Sham Lal, phone 9876543210, IELTS, evening batch, 3 November",
      language,
      now,
    });
    expect(result.ready).toBe(false);
    expect(result.draft.name).toBe("Sham Lal");
    expect(result.draft.phone).toBe(phone);
    expect(result.draft.course).toBe("ielts-pte");
    expect(result.draft.batch).toBe("evening");
    expect(result.draft.date).toBe("2026-11-03");
    expect(result.reply).toMatch(ask.send);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(
    PEOPLE.flatMap((name) => captureTexts(name).map((text) => ({ name, text }))).flatMap((row) =>
      languages.map((language) => ({ ...row, language })),
    ),
  )("$language keeps $name from $text off the batch", (row) => {
    const result = counsel({
      text: row.text,
      language: row.language,
      draft: { active: true, phone, course: "ielts-pte" },
      now,
    });
    expect(result.ready, row.text).toBe(false);
    expect(result.draft.name, row.text).toBe(row.name);
    expect(result.draft.phone, row.text).toBe(phone);
    expect(result.draft.batch ?? null, row.text).toBeNull();
    expect(result.draft.date ?? null, row.text).toBeNull();
    expect(result.reply, row.text).toMatch(ask.batch);
    expect(questionsIn(result.reply), result.reply).toBe(1);
  });

  it.each(languages)("rejects junk names in %s", (language) => {
    expect(JUNK.length).toBeGreaterThan(10);
    for (const text of JUNK) {
      const result = counsel({ text, language, draft: bases.name, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.ready, text).toBe(false);
      expect(result.reply, text).toMatch(ask.name);
      expect(questionsIn(result.reply), `${text} ${result.reply}`).toBe(1);
    }
  });

  it.each(languages)("cancels on the cancel list in %s", (language) => {
    expect(CANCELS).toHaveLength(38);
    for (const text of CANCELS) {
      const result = counsel({ text, language, draft: bases.confirm, now });
      expect(result.ready, text).toBe(false);
      expect(result.draft.name, text).toBeUndefined();
      expect(result.draft.phone, text).toBeUndefined();
      expect(result.draft.course, text).toBeUndefined();
      expect(result.reply, text).toMatch(ask.stopped);
    }
  });

  it.each(languages)("keeps the draft for non-cancel guards in %s", (language) => {
    expect(GUARDS).toHaveLength(67);
    for (const text of GUARDS) {
      const result = counsel({ text, language, draft: bases.confirm, now });
      expect(result.ready, text).toBe(false);
      expect(result.draft.name, text).toBe("Simran");
      expect(result.draft.phone, text).toBe(phone);
      expect(result.draft.course, text).toBe("ielts-pte");
    }
  });

  it.each(languages)("walks a booking without taking Sham as the batch in %s", (language) => {
    const booked = counsel({ text: "Book IELTS", language, now });
    expect(booked.draft.course).toBe("ielts-pte");
    expect(booked.draft.name ?? null).toBeNull();
    expect(booked.draft.batch ?? null).toBeNull();
    expect(booked.reply).toMatch(ask.name);
    expect(questionsIn(booked.reply)).toBe(1);

    const named = counsel({ text: "Sham Singh", language, draft: booked.draft, now });
    expect(named.draft.name).toBe("Sham Singh");
    expect(named.draft.batch ?? null).toBeNull();
    expect(named.reply).toMatch(ask.phone);
    expect(questionsIn(named.reply)).toBe(1);

    const phoned = counsel({ text: phone, language, draft: named.draft, now });
    expect(phoned.draft.phone).toBe(phone);
    expect(phoned.draft.batch ?? null).toBeNull();
    expect(phoned.reply).toMatch(ask.batch);
    expect(questionsIn(phoned.reply)).toBe(1);

    const dated = counsel({ text: "3 November", language, draft: phoned.draft, now });
    expect(dated.ready).toBe(false);
    expect(dated.draft.name).toBe("Sham Singh");
    expect(dated.draft.date).toBe("2026-11-03");
    expect(dated.draft.batch ?? null).toBeNull();
    expect(dated.reply).toMatch(ask.batch);
    expect(questionsIn(dated.reply)).toBe(1);
  });

  it.each(languages)("answers a fee question without opening a booking in %s", (language) => {
    const result = counsel({
      text: "my name is Ravi, what is the IELTS evening batch fee?",
      language,
      now,
    });
    expect(result.ready).toBe(false);
    expect(result.draft.active).toBeUndefined();
    expect(result.draft.name).toBeUndefined();
    expect(result.draft.course).toBeUndefined();
    expect(result.draft.batch).toBeUndefined();
    expect(result.reply).toMatch(ask.fee);
    expect(questionsIn(result.reply)).toBe(0);
  });

  it.each(languages)("keeps a name that shares a sentence break with a question in %s", (language) => {
    const result = counsel({ text: "name: Navjot Kaur. Is the trial online?", language, now });
    expect(result.ready).toBe(false);
    expect(result.draft.name).toBe("Navjot Kaur");
    expect(result.draft.batch ?? null).toBeNull();
    expect(result.reply).toMatch(ask.online);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("asks one question while a rename is pending in %s", (language) => {
    const online = counsel({ text: "Is the trial online?", language, draft: bases.rename, now });
    expect(online.draft.name).toBe("Simran");
    expect(online.draft.pendingName).toBe("Aman Gill");
    expect(online.ready).toBe(false);
    expect(online.reply).toMatch(ask.online);
    expect(online.reply).toContain("Aman Gill");
    expect(questionsIn(online.reply)).toBe(1);

    const joined = counsel({ text: "Who can join?", language, draft: bases.rename, now });
    expect(joined.draft.name).toBe("Simran");
    expect(joined.draft.pendingName).toBe("Aman Gill");
    expect(joined.ready).toBe(false);
    expect(questionsIn(joined.reply)).toBe(1);
  });
});

describe("round 18 name slot and one-shot capture", () => {
  const waiting = { active: true, phone, course: "ielts-pte" } satisfies Draft;

  it.each(
    ["Sham", "Subah", "Savera", "Sandhya", "शाम", "ਸ਼ਾਮ"].flatMap((name) => languages.map((language) => ({ name, language }))),
  )("$language bare $name asks for confirmation before it is saved", ({ name, language }) => {
    const result = counsel({ text: name, language, draft: waiting, now });
    expect(result.draft.name ?? null).toBeNull();
    expect(result.draft.pendingTimeName).toBe(name);
    expect(result.draft.batch ?? null).toBeNull();
    expect(result.ready).toBe(false);
    expect(result.reply).toContain(name);
    expect(questionsIn(result.reply)).toBe(1);
    const yes = language === "hi" ? "हाँ" : language === "pa" ? "ਹਾਂ" : "yes";
    const kept = counsel({ text: yes, language, draft: result.draft, now });
    expect(kept.draft.name).toBe(name);
    expect(kept.draft.pendingTimeName).toBeUndefined();
    expect(kept.draft.batch ?? null).toBeNull();
    expect(kept.reply).toMatch(ask.batch);
    expect(questionsIn(kept.reply)).toBe(1);
  });

  it.each(
    (
      [
        ["I am Sham", null],
        ["it's Sham", null],
        ["im Sham", null],
        ["main Sham", null],
        ["मैं शाम", null],
        ["ਮੈਂ ਸ਼ਾਮ", null],
        ["I am Savera", null],
        ["main Simran", "Simran"],
        ["mai Simran", "Simran"],
        ["main Simran hoon", "Simran"],
        ["name Sham", null],
        ["Naam Dev", "Naam Dev"],
        ["Main Singh", "Main Singh"],
        ["Sahi Ram", "Sahi Ram"],
        ["my name is Naam Dev", "Naam Dev"],
        ["my name is Main Singh", "Main Singh"],
        ["my name is Sahi Ram", "Sahi Ram"],
        ["my name is Sham Lal", "Sham Lal"],
        ["my name is Savera Kaur", "Savera Kaur"],
        ["my name is Subah Singh", "Subah Singh"],
        ["Nai", "Nai"],
        ["hii", null],
        ["helo", null],
        ["नमस्ते", null],
        ["sat sri akal", null],
      ] as const
    ).flatMap(([text, name]) => languages.map((language) => ({ text, name, language }))),
  )("$language name reply $text", ({ text, name, language }) => {
    const result = counsel({ text, language, draft: waiting, now });
    expect(result.draft.name ?? null, text).toBe(name);
    expect(result.draft.batch ?? null, text).toBeNull();
    expect(result.ready, text).toBe(false);
    expect(result.reply, text).toMatch(name ? ask.batch : ask.name);
    expect(questionsIn(result.reply), result.reply).toBe(1);
  });

  it.each(PEOPLE.flatMap((name) => languages.map((language) => ({ name, language }))))(
    "$language one-shot for $name N leaves the batch empty",
    ({ name, language }) => {
      const result = counsel({ text: `Book an IELTS trial for ${name} ${phone}`, language, now });
      expect(result.ready, name).toBe(false);
      expect(result.draft.name, name).toBe(name);
      expect(result.draft.phone, name).toBe(phone);
      expect(result.draft.course, name).toBe("ielts-pte");
      expect(result.draft.batch ?? null, name).toBeNull();
      expect(result.reply, name).toMatch(ask.batch);
      expect(questionsIn(result.reply), result.reply).toBe(1);
    },
  );

  it.each(PEOPLE.flatMap((name) => languages.map((language) => ({ name, language }))))(
    "$language name question $name, phone N keeps both",
    ({ name, language }) => {
      const result = counsel({
        text: `${name}, phone ${phone}`,
        language,
        draft: { active: true, course: "ielts-pte" },
        now,
      });
      expect(result.draft.name, name).toBe(name);
      expect(result.draft.phone, name).toBe(phone);
      expect(result.draft.batch ?? null, name).toBeNull();
      expect(result.ready, name).toBe(false);
      expect(result.reply, name).toMatch(ask.batch);
      expect(questionsIn(result.reply), result.reply).toBe(1);
    },
  );

  it.each(languages)("keeps a labelled evening batch on a one-shot name in %s", (language) => {
    const result = counsel({ text: "my name is Ravi, evening batch", language, now });
    expect(result.draft.name).toBe("Ravi");
    expect(result.draft.batch).toBe("evening");
    expect(result.draft.active).toBe(true);
    expect(result.ready).toBe(false);
    expect(result.reply).toMatch(ask.phone);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("does not open a booking from a name and a later fee question in %s", (language) => {
    const result = counsel({ text: "my name is Ravi. What is the IELTS evening batch fee?", language, now });
    expect(result.draft.active).toBeUndefined();
    expect(result.draft.name).toBeUndefined();
    expect(result.draft.batch).toBeUndefined();
    expect(result.draft.course).toBeUndefined();
    expect(result.reply).toMatch(ask.fee);
  });

  it.each(languages)("answers a course question and still asks the pending rename in %s", (language) => {
    const result = counsel({
      text: "What is the IELTS evening batch fee?",
      language,
      draft: bases.rename,
      now,
    });
    expect(result.draft.name).toBe("Simran");
    expect(result.draft.pendingName).toBe("Aman Gill");
    expect(result.draft.batch).toBe("morning");
    expect(result.draft.course).toBe("ielts-pte");
    expect(result.ready).toBe(false);
    expect(result.reply).toMatch(ask.fee);
    expect(result.reply).toContain("Aman Gill");
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("walks Sham, a for-name booking, and a bare Subah in %s", (language) => {
    const yes = language === "hi" ? "हाँ" : language === "pa" ? "ਹਾਂ" : "yes";
    const booked = counsel({ text: "Book IELTS", language, now });
    expect(booked.draft.batch ?? null).toBeNull();
    const named = counsel({ text: "Sham", language, draft: booked.draft, now });
    expect(named.draft.pendingTimeName).toBe("Sham");
    expect(named.draft.name ?? null).toBeNull();
    expect(questionsIn(named.reply)).toBe(1);
    const accepted = counsel({ text: yes, language, draft: named.draft, now });
    expect(accepted.draft.name).toBe("Sham");
    expect(accepted.draft.batch ?? null).toBeNull();
    expect(accepted.reply).toMatch(ask.phone);
    expect(questionsIn(accepted.reply)).toBe(1);

    const shot = counsel({ text: `Book an IELTS trial for Savera Kaur ${phone}`, language, now });
    expect(shot.draft.name).toBe("Savera Kaur");
    expect(shot.draft.batch ?? null).toBeNull();
    const batched = counsel({ text: "morning", language, draft: shot.draft, now });
    expect(batched.draft.batch).toBe("morning");
    expect(batched.draft.name).toBe("Savera Kaur");
    expect(batched.reply).toMatch(ask.date);

    const subah = counsel({ text: "Subah", language, draft: waiting, now });
    expect(subah.draft.pendingTimeName).toBe("Subah");
    const evening = counsel({ text: yes, language, draft: subah.draft, now });
    expect(evening.draft.name).toBe("Subah");
    expect(evening.draft.batch ?? null).toBeNull();
    expect(evening.reply).toMatch(ask.batch);
    expect(questionsIn(evening.reply)).toBe(1);
  });
});

describe("round 19 name rules", () => {
  it.each(languages)("drops junk, keeps a trailing batch, and protects real two-word names in %s", (language) => {
    for (const text of ["hmm", "later", "skip", "test", "na", "none", "online", "Punjabi", "interested", "booking", "hello"]) {
      const result = counsel({ text, language, draft: bases.name, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.reply, text).toMatch(ask.name);
      expect(questionsIn(result.reply), `${text} ${result.reply}`).toBe(1);
    }
    for (const text of ["I want evening", "I need evening", "kal shaam"]) {
      const result = counsel({ text, language, draft: bases.name, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.draft.batch, text).toBe("evening");
      expect(result.reply, text).toMatch(ask.name);
      expect(questionsIn(result.reply), result.reply).toBe(1);
    }
    const shaam = counsel({ text: "Simran shaam", language, draft: bases.name, now });
    expect(shaam.draft.name).toBe("Simran");
    expect(shaam.draft.batch).toBe("evening");
    expect(shaam.reply).toMatch(ask.phone);
    expect(questionsIn(shaam.reply)).toBe(1);
    const kaur = counsel({ text: "Simran Kaur evening", language, draft: bases.name, now });
    expect(kaur.draft.name).toBe("Simran Kaur");
    expect(kaur.draft.batch).toBe("evening");
    const hindi = counsel({ text: "सिमरन शाम", language, draft: bases.name, now });
    expect(hindi.draft.name).toBe("सिमरन");
    expect(hindi.draft.batch).toBe("evening");
    expect(counsel({ text: "Main Singh", language, draft: bases.name, now }).draft.name).toBe("Main Singh");
    expect(counsel({ text: "Main Kaur", language, draft: bases.name, now }).draft.name).toBe("Main Kaur");
    expect(counsel({ text: "Naam Dev", language, draft: bases.name, now }).draft.name).toBe("Naam Dev");
    expect(counsel({ text: "my name is Main Singh Gill", language, draft: bases.name, now }).draft.name).toBe("Main Singh Gill");
    expect(counsel({ text: "my name is Naam Dev Singh", language, draft: bases.name, now }).draft.name).toBe("Naam Dev Singh");
    const neet = counsel({ text: "NEET instead", language, draft: bases.name, now });
    expect(neet.draft.course).toBe("neet-foundation");
    expect(neet.draft.name).toBeUndefined();
    expect(neet.reply).toMatch(ask.name);
    expect(questionsIn(neet.reply)).toBe(1);
  });
});

describe("round 20 time-word names stay names", () => {
  const summary = {
    active: true,
    confirming: true,
    name: "Simran Kaur",
    phone,
    course: "ielts-pte",
    batch: "morning" as const,
    date: "2026-11-20",
  } satisfies Draft;
  const midway = {
    active: true,
    name: "Simran Kaur",
    phone,
    course: "ielts-pte",
    batch: "evening" as const,
  } satisfies Draft;

  it.each(
    (
      [
        ["en", "my name is Sham", "Sham"],
        ["hi", "मेरा नाम शाम है", "शाम"],
        ["pa", "ਮੇਰਾ ਨਾਂ ਸ਼ਾਮ ਹੈ", "ਸ਼ਾਮ"],
        ["en", "change name to Sham", "Sham"],
        ["en", "name is Sham", "Sham"],
        ["en", "call me Subah", "Subah"],
      ] as const
    ).map(([language, text, name]) => ({ language, text, name })),
  )("$language $text renames without touching the batch", ({ language, text, name }) => {
    const asked = counsel({ text, language, draft: summary, now });
    expect(asked.ready, text).toBe(false);
    expect(asked.draft.name, text).toBe("Simran Kaur");
    expect(asked.draft.pendingName, text).toBe(name);
    expect(asked.draft.batch, text).toBe("morning");
    expect(questionsIn(asked.reply), asked.reply).toBe(1);
    const yes = language === "hi" ? "हाँ" : language === "pa" ? "ਹਾਂ" : "yes";
    const renamed = counsel({ text: yes, language, draft: asked.draft, now });
    expect(renamed.draft.name, text).toBe(name);
    expect(renamed.draft.batch, text).toBe("morning");
    expect(renamed.ready, text).toBe(false);
  });

  it.each(languages)("mid-booking my name is Subah keeps the evening batch in %s", (language) => {
    const text = language === "hi" ? "मेरा नाम सुबह है" : language === "pa" ? "ਮੇਰਾ ਨਾਂ ਸਵੇਰ ਹੈ" : "my name is Subah";
    const expected = language === "hi" ? "सुबह" : language === "pa" ? "ਸਵੇਰ" : "Subah";
    const asked = counsel({ text, language, draft: midway, now });
    expect(asked.draft.name).toBe("Simran Kaur");
    expect(asked.draft.pendingName).toBe(expected);
    expect(asked.draft.batch).toBe("evening");
    expect(questionsIn(asked.reply)).toBe(1);
  });

  it.each(languages)("one-shot for Sham does not choose evening in %s", (language) => {
    const result = counsel({ text: `Book an IELTS trial for Sham ${phone}`, language, now });
    expect(result.draft.name).toBe("Sham");
    expect(result.draft.batch ?? null).toBeNull();
    expect(result.draft.phone).toBe(phone);
    expect(result.draft.course).toBe("ielts-pte");
    expect(result.reply).toMatch(ask.batch);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("sets an explicit time-word name without a second confirm in %s", (language) => {
    const result = counsel({ text: "my name is Sandhya", language, draft: bases.name, now });
    expect(result.draft.name).toBe("Sandhya");
    expect(result.draft.pendingTimeName).toBeUndefined();
    expect(result.draft.batch ?? null).toBeNull();
    expect(result.reply).toMatch(ask.phone);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("no, Sham Lal at confirm asks to rename in %s", (language) => {
    const asked = counsel({ text: "no, Sham Lal", language, draft: bases.confirm, now });
    expect(asked.draft.name).toBe("Simran");
    expect(asked.draft.pendingName).toBe("Sham Lal");
    expect(asked.draft.batch).toBe("morning");
    expect(asked.ready).toBe(false);
    expect(questionsIn(asked.reply)).toBe(1);
  });

  it.each(languages)("Simran, weekend batch keeps Simran in %s", (language) => {
    const result = counsel({ text: "Simran, weekend batch", language, draft: bases.name, now });
    expect(result.draft.name).toBe("Simran");
    expect(result.draft.batch).toBe("weekend");
    expect(result.reply).toMatch(ask.phone);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("a bare one-liner keeps its batch in %s", (language) => {
    const result = counsel({ text: "my name is Simran morning", language, now });
    expect(result.draft.name).toBe("Simran");
    expect(result.draft.batch).toBe("morning");
    expect(result.ready).toBe(false);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("does not save junk names in %s", (language) => {
    for (const text of ["hmmm", "student", "help", "name", "mera naam", "asdf", "guest", "India"]) {
      const result = counsel({ text, language, draft: bases.name, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.reply, text).toMatch(ask.name);
    }
  });
});

describe("round 21 greetings do not choose a batch", () => {
  const greetings = [
    ["en", "good evening, book an IELTS trial", "ielts-pte"],
    ["en", "Good morning! I want to book an IELTS trial", "ielts-pte"],
    ["en", "Good evening sir, NEET trial book karna hai", "neet-foundation"],
    ["en", "Hello, good evening. Book a trial for spoken english", "spoken-english"],
    ["hi", "शुभ संध्या, book an IELTS trial", "ielts-pte"],
    ["hi", "सुप्रभात, IELTS trial book karo", "ielts-pte"],
    ["hi", "शुभ रात्रि, book an IELTS trial", "ielts-pte"],
    ["pa", "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, book an IELTS trial", "ielts-pte"],
    ["pa", "ਸ਼ੁੱਭ ਸਵੇਰ, book an IELTS trial", "ielts-pte"],
    ["en", "shubh sandhya, book an IELTS trial", "ielts-pte"],
    ["en", "suprabhat, book an IELTS trial", "ielts-pte"],
    ["en", "gm, book an IELTS trial", "ielts-pte"],
  ] as const;

  it.each(greetings)("%s greeting booking asks for the batch: %s", (language, text, course) => {
    const opened = counsel({ text, language, now });
    expect(opened.draft.course, text).toBe(course);
    expect(opened.draft.batch ?? null, text).toBeNull();
    expect(opened.draft.name ?? null, text).toBeNull();
    expect(opened.reply, text).toMatch(ask.name);
    expect(questionsIn(opened.reply), opened.reply).toBe(1);
  });

  it.each(languages)("keeps an explicit evening batch beside a greeting in %s", (language) => {
    const result = counsel({ text: "good evening, evening batch, book an IELTS trial", language, now });
    expect(result.draft.batch).toBe("evening");
    expect(result.draft.course).toBe("ielts-pte");
    expect(result.reply).toMatch(ask.name);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("still accepts a bare evening answer in %s", (language) => {
    const result = counsel({ text: "evening", language, draft: bases.batch, now });
    expect(result.draft.batch).toBe("evening");
    expect(result.draft.name).toBe("Simran");
    expect(result.reply).toMatch(ask.date);
    expect(questionsIn(result.reply)).toBe(1);
  });

  it.each(languages)("sets for-name and change-name without asking again in %s", (language) => {
    const introduced = counsel({ text: "for Simran", language, draft: bases.name, now });
    expect(introduced.draft.name).toBe("Simran");
    expect(introduced.reply).toMatch(ask.phone);
    expect(questionsIn(introduced.reply)).toBe(1);
    const changed = counsel({ text: "change name to Ravi", language, draft: bases.name, now });
    expect(changed.draft.name).toBe("Ravi");
    expect(changed.reply).toMatch(ask.phone);
    expect(questionsIn(changed.reply)).toBe(1);
    expect(counsel({ text: "naah", language, draft: bases.name, now }).draft.name).toBeUndefined();
    const lined = counsel({ text: "Ravi, 9876501234, evening", language, draft: bases.name, now });
    expect(lined.draft.name).toBe("Ravi");
    expect(lined.draft.phone).toBe("9876501234");
    expect(lined.draft.batch).toBe("evening");
    expect(lined.reply).toMatch(ask.date);
    expect(questionsIn(lined.reply)).toBe(1);
    const hindi = counsel({ text: "मेरा नाम शाम है", language, draft: bases.name, now });
    expect(hindi.draft.name).toBe("शाम");
    expect(hindi.draft.pendingTimeName).toBeUndefined();
    expect(hindi.draft.batch ?? null).toBeNull();
    expect(hindi.reply).toMatch(ask.phone);
    expect(questionsIn(hindi.reply)).toBe(1);
  });
});

describe("corpus through the chat route", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "udaan-corpus-"));
    process.env.BOOKINGS_STORE_PATH = path.join(directory, "bookings.json");
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_PROVIDER;
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY;
    resetMemoryAttemptsForTests();
  });

  afterEach(async () => {
    delete process.env.BOOKINGS_STORE_PATH;
    await rm(directory, { recursive: true, force: true });
  });

  async function post(message: string, language: (typeof languages)[number], draft: Draft) {
    return postChat(
      new Request("http://127.0.0.1:43123/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
        body: JSON.stringify({ message, language, draft, history: [] }),
      }),
    );
  }

  it("saves a confirmed trial and records the chat source", async () => {
    const response = await post("yes", "en", {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876501111",
      course: "ielts-pte",
      batch: "morning",
      date: "2026-11-20",
    });
    expect(response.status).toBe(200);
    const saved = await listBookings();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe("Simran");
    expect(saved[0]?.source).toBe("chat");
    expect(saved[0]?.course).toBe("ielts-pte");
    expect(saved[0]?.batch).toBe("morning");
    expect(saved[0]?.date).toBe("2026-11-20");
  });

  it("saves a Hindi confirmation under the draft name", async () => {
    const response = await post("हाँ", "hi", {
      active: true,
      confirming: true,
      name: "Simran Kaur",
      phone: "9876502222",
      course: "ielts-pte",
      batch: "morning",
      date: "2026-11-20",
    });
    expect(response.status).toBe(200);
    const saved = await listBookings();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe("Simran Kaur");
    expect(saved[0]?.language).toBe("hi");
    expect(saved[0]?.source).toBe("chat");
  });

  it("does not save when a pending rename is declined with no, correct", async () => {
    const response = await post("no, correct", "pa", {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876503333",
      course: "ielts-pte",
      batch: "morning",
      date: "2026-11-20",
      pendingName: "Aman Gill",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { booking: unknown; draft: { name?: string; pendingName?: string } };
    expect(body.booking).toBeNull();
    expect(body.draft.name).toBe("Simran");
    expect(body.draft.pendingName).toBeUndefined();
    expect(await listBookings()).toHaveLength(0);
  });

  it("saves a multi-turn chat booking and declines a rename without saving", async () => {
    const opened = await post("Book an IELTS trial for Simran 9876504444", "en", {});
    expect(opened.status).toBe(200);
    const openedBody = (await opened.json()) as { booking: unknown; draft: Draft };
    expect(openedBody.booking).toBeNull();
    expect(openedBody.draft.name).toBe("Simran");
    expect(openedBody.draft.batch).toBeUndefined();

    const batched = await post("morning", "en", openedBody.draft);
    const batchedBody = (await batched.json()) as { draft: Draft };
    expect(batchedBody.draft.batch).toBe("morning");
    expect(batchedBody.draft.name).toBe("Simran");

    const dated = await post("20 November", "en", batchedBody.draft);
    const datedBody = (await dated.json()) as { draft: Draft; booking: unknown };
    expect(datedBody.booking).toBeNull();
    expect(datedBody.draft.confirming).toBe(true);
    expect(datedBody.draft.date).toBe("2026-11-20");

    const saved = await post("yes", "en", datedBody.draft);
    expect(saved.status).toBe(200);
    const stored = await listBookings();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe("Simran");
    expect(stored[0]?.batch).toBe("morning");
    expect(stored[0]?.date).toBe("2026-11-20");
    expect(stored[0]?.source).toBe("chat");
  });

  it("saves a confirmed one-word Sham, शाम and ਸ਼ਾਮ booking", async () => {
    const cases = [
      { name: "Sham", language: "en" as const, yes: "yes", phone: "9876505551" },
      { name: "शाम", language: "hi" as const, yes: "हाँ", phone: "9876505552" },
      { name: "ਸ਼ਾਮ", language: "pa" as const, yes: "ਹਾਂ", phone: "9876505553" },
    ];
    for (const item of cases) {
      const asked = await post(item.name, item.language, {
        active: true,
        phone: item.phone,
        course: "ielts-pte",
        batch: "morning",
        date: "2026-11-20",
      });
      const askedBody = (await asked.json()) as { booking: unknown; draft: Draft };
      expect(askedBody.booking, item.name).toBeNull();
      expect(askedBody.draft.pendingTimeName, item.name).toBe(item.name);
      const confirmed = await post(item.yes, item.language, askedBody.draft);
      const confirmedBody = (await confirmed.json()) as { booking: unknown; draft: Draft };
      expect(confirmedBody.booking, item.name).toBeNull();
      expect(confirmedBody.draft.name, item.name).toBe(item.name);
      const saved = await post(item.yes, item.language, confirmedBody.draft);
      expect(saved.status).toBe(200);
      const stored = await listBookings();
      expect(stored.some((booking) => booking.name === item.name && booking.phone === item.phone && booking.source === "chat")).toBe(true);
    }
  });

  it("saves main Simran and Simran morning, and keeps the old name on naah, same", async () => {
    const simran = await post("main Simran", "en", {
      active: true,
      phone: "9876505554",
      course: "ielts-pte",
      batch: "evening",
      date: "2026-11-20",
    });
    const simranBody = (await simran.json()) as { booking: unknown; draft: Draft };
    expect(simranBody.booking).toBeNull();
    expect(simranBody.draft.name).toBe("Simran");
    const simranSaved = await post("yes", "en", simranBody.draft);
    expect((await listBookings()).some((booking) => booking.name === "Simran" && booking.phone === "9876505554")).toBe(true);
    expect((await simranSaved.json()) as { booking: { id?: string } }).toMatchObject({ booking: { id: expect.stringMatching(/^UA-/) } });

    const morning = await post("Simran morning", "en", {
      active: true,
      phone: "9876505555",
      course: "ielts-pte",
    });
    const morningBody = (await morning.json()) as { draft: Draft; booking: unknown };
    expect(morningBody.booking).toBeNull();
    expect(morningBody.draft.name).toBe("Simran");
    expect(morningBody.draft.batch).toBe("morning");
    const dated = await post("20 November", "en", morningBody.draft);
    const datedBody = (await dated.json()) as { draft: Draft };
    const morningSaved = await post("yes", "en", datedBody.draft);
    expect(morningSaved.status).toBe(200);
    expect((await listBookings()).some((booking) => booking.phone === "9876505555" && booking.batch === "morning" && booking.name === "Simran")).toBe(true);

    const declined = await post("naah, same", "en", {
      active: true,
      confirming: true,
      name: "Simran",
      pendingName: "Aman Gill",
      phone: "9876505556",
      course: "ielts-pte",
      batch: "morning",
      date: "2026-11-20",
    });
    const declinedBody = (await declined.json()) as { booking: unknown; draft: Draft };
    expect(declinedBody.booking).toBeNull();
    expect(declinedBody.draft.name).toBe("Simran");
    expect(declinedBody.draft.pendingName).toBeUndefined();
    expect((await listBookings()).some((booking) => booking.phone === "9876505556")).toBe(false);
  });

  it("saves a lead-in time name without switching the batch", async () => {
    const cases = [
      { language: "en" as const, text: "my name is Sham", yes: "yes", name: "Sham", phone: "9876506661" },
      { language: "hi" as const, text: "मेरा नाम शाम है", yes: "हाँ", name: "शाम", phone: "9876506662" },
      { language: "pa" as const, text: "ਮੇਰਾ ਨਾਂ ਸ਼ਾਮ ਹੈ", yes: "ਹਾਂ", name: "ਸ਼ਾਮ", phone: "9876506663" },
    ];
    for (const item of cases) {
      const asked = await post(item.text, item.language, {
        active: true,
        confirming: true,
        name: "Simran Kaur",
        phone: item.phone,
        course: "ielts-pte",
        batch: "morning",
        date: "2026-11-20",
      });
      const askedBody = (await asked.json()) as { booking: unknown; draft: Draft };
      expect(askedBody.booking, item.text).toBeNull();
      expect(askedBody.draft.batch, item.text).toBe("morning");
      expect(askedBody.draft.pendingName, item.text).toBe(item.name);
      const renamed = await post(item.yes, item.language, askedBody.draft);
      const renamedBody = (await renamed.json()) as { booking: unknown; draft: Draft };
      expect(renamedBody.booking, item.text).toBeNull();
      expect(renamedBody.draft.name, item.text).toBe(item.name);
      expect(renamedBody.draft.batch, item.text).toBe("morning");
      const saved = await post(item.yes, item.language, renamedBody.draft);
      expect(saved.status).toBe(200);
      const stored = await listBookings();
      expect(stored.some((booking) => booking.phone === item.phone && booking.name === item.name && booking.batch === "morning")).toBe(true);
    }
  });

  it("saves a mid-booking Subah rename on the evening batch and a one-shot Sham on morning", async () => {
    const asked = await post("my name is Subah", "en", {
      active: true,
      name: "Simran Kaur",
      phone: "9876506664",
      course: "ielts-pte",
      batch: "evening",
    });
    const askedBody = (await asked.json()) as { draft: Draft; booking: unknown };
    expect(askedBody.booking).toBeNull();
    expect(askedBody.draft.batch).toBe("evening");
    expect(askedBody.draft.pendingName).toBe("Subah");
    const renamed = await post("yes", "en", askedBody.draft);
    const renamedBody = (await renamed.json()) as { draft: Draft };
    expect(renamedBody.draft.name).toBe("Subah");
    expect(renamedBody.draft.batch).toBe("evening");
    const dated = await post("20 November", "en", renamedBody.draft);
    const saved = await post("yes", "en", ((await dated.json()) as { draft: Draft }).draft);
    expect(saved.status).toBe(200);
    expect((await listBookings()).some((booking) => booking.phone === "9876506664" && booking.name === "Subah" && booking.batch === "evening")).toBe(true);

    const opened = await post("Book an IELTS trial for Sham 9876506665", "en", {});
    const openedBody = (await opened.json()) as { draft: Draft; booking: unknown };
    expect(openedBody.booking).toBeNull();
    expect(openedBody.draft.name).toBe("Sham");
    expect(openedBody.draft.batch).toBeUndefined();
    const morning = await post("morning", "en", openedBody.draft);
    const datedShot = await post("20 November", "en", ((await morning.json()) as { draft: Draft }).draft);
    const shotSaved = await post("yes", "en", ((await datedShot.json()) as { draft: Draft }).draft);
    expect(shotSaved.status).toBe(200);
    expect((await listBookings()).some((booking) => booking.phone === "9876506665" && booking.name === "Sham" && booking.batch === "morning")).toBe(true);
  });

  it("saves the batch chosen after a greeting, not the greeting itself", async () => {
    const openings = [
      { language: "en" as const, text: "good evening, book an IELTS trial", phone: "9876507771" },
      { language: "hi" as const, text: "शुभ संध्या, book an IELTS trial", phone: "9876507772" },
      { language: "pa" as const, text: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, book an IELTS trial", phone: "9876507773" },
    ];
    for (const item of openings) {
      const opened = await post(item.text, item.language, {});
      const openedBody = (await opened.json()) as { draft: Draft; booking: unknown };
      expect(openedBody.booking, item.text).toBeNull();
      expect(openedBody.draft.batch, item.text).toBeUndefined();
      expect(openedBody.draft.course, item.text).toBe("ielts-pte");
      const named = await post("Simran", item.language, openedBody.draft);
      const phoned = await post(item.phone, item.language, ((await named.json()) as { draft: Draft }).draft);
      const batched = await post("morning", item.language, ((await phoned.json()) as { draft: Draft }).draft);
      const batchedBody = (await batched.json()) as { draft: Draft };
      expect(batchedBody.draft.batch, item.text).toBe("morning");
      const dated = await post("20 November", item.language, batchedBody.draft);
      const saved = await post("yes", item.language, ((await dated.json()) as { draft: Draft }).draft);
      expect(saved.status, item.text).toBe(200);
      expect(
        (await listBookings()).some(
          (booking) => booking.phone === item.phone && booking.name === "Simran" && booking.batch === "morning",
        ),
      ).toBe(true);
    }
  });

  it("keeps Sham Singh as the name when the route sees for-name phone text", async () => {
    const response = await post("for Sham Singh, phone 9876543210", "en", {
      active: true,
      phone,
      course: "ielts-pte",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { booking: unknown; draft: { name?: string; batch?: string } };
    expect(body.booking).toBeNull();
    expect(body.draft.name).toBe("Sham Singh");
    expect(body.draft.batch).toBeUndefined();
    expect(await listBookings()).toHaveLength(0);
  });
});
