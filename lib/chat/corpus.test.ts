import { describe, expect, it } from "vitest";
import { counsel, type Draft } from "@/lib/chat/respond";

const now = new Date("2026-10-31T08:00:00.000Z");
const phone = "9876543210";

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
};

const rows: Row[] = [
  { step: "name", text: "Sham Singh", name: "Sham Singh", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "Sham Lal", name: "Sham Lal", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "Sham Sundar", name: "Sham Sundar", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "शाम लाल", name: "शाम लाल", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "ਸ਼ਾਮ ਲਾਲ", name: "ਸ਼ਾਮ ਲਾਲ", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "मेरा नाम शाम लाल है", name: "शाम लाल", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "my name is Sham Lal", name: "Sham Lal", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "I am Sham Sundar", name: "Sham Sundar", phone: null, date: null, batch: null, sent: false, next: /phone/i },
  { step: "name", text: "Simran morning", name: "Simran", phone: null, date: null, batch: "morning", sent: false, next: /phone/i },
  { step: "name", text: "Simran, evening batch", name: "Simran", phone: null, date: null, batch: "evening", sent: false, next: /phone/i },
  { step: "name", text: "evening batch", name: null, phone: null, date: null, batch: "evening", sent: false, next: /name/i },
  { step: "name", text: "one sec", name: null, phone: null, date: null, batch: null, sent: false, next: /name/i },
  { step: "name", text: "one minute", name: null, phone: null, date: null, batch: null, sent: false, next: /name/i },
  { step: "name", text: "I am ready", name: null, phone: null, date: null, batch: null, sent: false, next: /name/i },
  { step: "name", text: "I am fine", name: null, phone: null, date: null, batch: null, sent: false, next: /name/i },
  { step: "phone", text: "9876543210", name: "Simran", phone, date: null, batch: null, sent: false, next: /batch/i },
  { step: "phone", text: "change phone to 9876501234", name: "Simran", phone: "9876501234", date: null, batch: null, sent: false, next: /batch/i },
  { step: "batch", text: "evening batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: /date/i },
  { step: "batch", text: "morning batch", name: "Simran", phone, date: null, batch: "morning", sent: false, next: /date/i },
  { step: "batch", text: "shaam ka batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: /date/i },
  { step: "batch", text: "kal shaam", name: "Simran", phone, date: null, batch: "evening", sent: false, next: /date/i },
  { step: "batch", text: "evening", name: "Simran", phone, date: null, batch: "evening", sent: false, next: /date/i },
  { step: "batch", text: "सुबह", name: "Simran", phone, date: null, batch: "morning", sent: false, next: /date/i },
  { step: "date", text: "3 November", name: "Simran", phone, date: "2026-11-03", batch: "morning", sent: false, next: /send/i },
  { step: "date", text: "evening batch", name: "Simran", phone, date: null, batch: "evening", sent: false, next: /date/i },
  { step: "date", text: "change phone to 9876501234", name: "Simran", phone: "9876501234", date: null, batch: "morning", sent: false, next: /date/i },
  { step: "date", text: "Is the NEET trial class on Saturday?", name: "Simran", phone, date: null, batch: "morning", sent: false, next: /neet/i },
  { step: "date", text: "wrong", name: "Simran", phone, date: null, batch: "morning", sent: false, next: /which part is wrong/i },
  { step: "confirm", text: "evening batch", name: "Simran", phone, date: "2026-11-20", batch: "evening", sent: false, next: /send/i },
  { step: "confirm", text: "evening instead", name: "Simran", phone, date: "2026-11-20", batch: "evening", sent: false, next: /send/i },
  { step: "confirm", text: "the name is correct", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: true, next: /sending/i },
  { step: "confirm", text: "I am ready", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: true, next: /sending/i },
  { step: "confirm", text: "I am fine", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /which part|send/i },
  { step: "confirm", text: "yes please", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: true, next: /sending/i },
  { step: "confirm", text: "the name is wrong", name: null, phone, date: "2026-11-20", batch: "morning", sent: false, next: /correct name/i },
  { step: "confirm", text: "my name is now Aman Gill", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /Aman Gill/ },
  { step: "confirm", text: "ਸਭ ਸਹੀ ਹੈ", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: true, next: /sending|ਭੇਜ/ },
  { step: "confirm", text: "cancel", name: null, phone: null, date: null, batch: null, sent: false, next: /stopped|nothing/i },
  { step: "confirm", text: "stop and think", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send|which part/i },
  { step: "confirm", text: "don't cancel", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send|which part/i },
  { step: "confirm", text: "ruko", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send|which part/i },
  { step: "rename", text: "correct", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send/i },
  { step: "rename", text: "yes please", name: "Aman Gill", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send/i },
  { step: "rename", text: "no thanks", name: "Simran", phone, date: "2026-11-20", batch: "morning", sent: false, next: /send/i },
  { step: "rename", text: "correct, evening batch", name: "Aman Gill", phone, date: "2026-11-20", batch: "evening", sent: false, next: /send/i },
  { step: "rename", text: "correct and evening batch", name: "Aman Gill", phone, date: "2026-11-20", batch: "evening", sent: false, next: /send/i },
];

describe("round 8–16 regression corpus", () => {
  it.each(rows)("$step: $text", (row) => {
    const result = counsel({ text: row.text, language: "en", draft: bases[row.step], now });
    expect(result.ready, row.text).toBe(row.sent);
    expect(result.draft.name ?? null, row.text).toBe(row.name);
    expect(result.draft.phone ?? null, row.text).toBe(row.phone);
    expect(result.draft.date ?? null, row.text).toBe(row.date);
    expect(result.draft.batch ?? null, row.text).toBe(row.batch);
    expect(result.reply, row.text).toMatch(row.next);
    if (row.step === "rename" && row.text.startsWith("correct,") === false && row.text.includes("and evening") === false && !row.sent) {
      expect(result.reply, row.text).not.toMatch(/Change the name.*Shall I send|Shall I send.*Change the name/);
    }
  });

  it("fills a one-line booking", () => {
    const result = counsel({
      text: "my name is Sham Lal, phone 9876543210, IELTS, evening batch, 3 November",
      language: "en",
      now,
    });
    expect(result.ready).toBe(false);
    expect(result.draft.name).toBe("Sham Lal");
    expect(result.draft.phone).toBe(phone);
    expect(result.draft.course).toBe("ielts-pte");
    expect(result.draft.batch).toBe("evening");
    expect(result.draft.date).toBe("2026-11-03");
    expect(result.reply).toMatch(/send/i);
  });
});
