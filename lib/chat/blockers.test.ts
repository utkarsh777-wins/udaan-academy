import { describe, expect, it } from "vitest";
import { getCourse } from "@/lib/academy";
import { counsel, formServerMessage, formatBatchTime, savedBookingReply } from "@/lib/chat/respond";
import { parseUtterance } from "@/lib/chat/parser";
import { formatLongDate } from "@/lib/dates";

const now = new Date("2026-10-31T08:00:00.000Z");

describe("blocker regressions", () => {
  it("B1 does not store the Hindi or Punjabi booking request as the name", () => {
    const hindi = counsel({ text: "ट्रायल बुक करनी है", language: "hi", now });
    expect(hindi.draft.name).toBeUndefined();
    expect(hindi.ready).toBe(false);
    const named = counsel({ text: "सिमरन कौर", language: "hi", draft: hindi.draft, now });
    expect(named.draft.name).toBe("सिमरन कौर");

    const punjabi = counsel({ text: "ਟਰਾਇਲ ਬੁੱਕ ਕਰਨੀ ਹੈ", language: "pa", now });
    expect(punjabi.draft.name).toBeUndefined();
    const namedPa = counsel({ text: "ਸਿਮਰਨ ਕੌਰ", language: "pa", draft: punjabi.draft, now });
    expect(namedPa.draft.name).toBe("ਸਿਮਰਨ ਕੌਰ");
  });

  it("B2 strips the trailing copula from a stated name", () => {
    expect(parseUtterance("मेरा नाम सिमरन है").name).toBe("सिमरन");
    expect(parseUtterance("ਮੇਰਾ ਨਾਮ ਸਿਮਰਨ ਹੈ").name).toBe("ਸਿਮਰਨ");
  });

  it("B3 reads the same phone formats as the booking form", () => {
    expect(parseUtterance("my number is +91 98765 43210").phone).toBe("9876543210");
    expect(parseUtterance("phone 098765 43210").phone).toBe("9876543210");
    const both = parseUtterance("9876512345 20 नवंबर", now);
    expect(both.phone).toBe("9876512345");
    expect(both.date).toBe("2026-11-20");
  });

  it("B4 does not treat a date word inside another word as a date", () => {
    expect(parseUtterance("कल्पना", now).date).toBeNull();
    expect(parseUtterance("आजकल मैं IELTS चाहता हूँ", now).date).toBeNull();
    expect(parseUtterance("ਇਕੱਲੇ", now).date).toBeNull();
    expect(parseUtterance("कबड्डी", now).intent).not.toBe("batches");
  });

  it("B5 shows a summary and saves only after yes", () => {
    let draft = {};
    for (const text of ["Book a free trial class", "Aman Gill", "9876543210", "IELTS", "morning"]) {
      draft = counsel({ text, language: "en", draft, now }).draft;
    }
    const summary = counsel({ text: "20 November 2026", language: "en", draft, now });
    expect(summary.ready).toBe(false);
    expect(summary.draft.confirming).toBe(true);
    expect(summary.reply).toContain("Shall I send this?");
    const saved = counsel({ text: "yes", language: "en", draft: summary.draft, now });
    expect(saved.ready).toBe(true);
    const hindi = counsel({ text: "हाँ", language: "hi", draft: summary.draft, now });
    expect(hindi.ready).toBe(true);
    const punjabi = counsel({ text: "ਠੀਕ ਹੈ", language: "pa", draft: summary.draft, now });
    expect(punjabi.ready).toBe(true);
    const change = counsel({ text: "wait", language: "en", draft: summary.draft, now });
    expect(change.ready).toBe(false);
    expect(change.reply.toLowerCase()).toContain("which part");
  });

  it("B6 reads Punjabi and alternate Hindi month names", () => {
    expect(parseUtterance("20 ਨਵੰਬਰ", now).date).toBe("2026-11-20");
    expect(parseUtterance("20 नवम्बर", now).date).toBe("2026-11-20");
    const missed = counsel({
      text: "sometime",
      language: "hi",
      draft: { active: true, name: "सिमरन", phone: "9876543210", course: "ielts-pte", batch: "morning" },
      now,
    });
    expect(missed.reply).toContain("तारीख समझ नहीं आई");
  });

  it("R2-B1 a date beyond 45 days never reaches confirming", () => {
    const far = counsel({
      text: "5 January 2027",
      language: "hi",
      draft: { active: true, name: "सिमरन", phone: "9876543210", course: "ielts-pte", batch: "morning" },
      now,
    });
    expect(far.draft.confirming).toBeFalsy();
    expect(far.draft.date).toBeUndefined();
    expect(far.reply).toContain("45");
    expect(far.reply).not.toContain("बैच के दिन नहीं");
    const past = counsel({
      text: "15 October",
      language: "pa",
      draft: { active: true, name: "ਸਿਮਰਨ", phone: "9876543211", course: "ielts-pte", batch: "morning" },
      now,
    });
    expect(past.draft.confirming).toBeFalsy();
    expect(past.reply).toContain("45");
    expect(past.reply).not.toContain("ਬੈਚ ਦੇ ਦਿਨ ਨਹੀਂ");
  });

  it("R2-N1 reads natural name phrasings and rejects junk", () => {
    expect(parseUtterance("ਮੇਰਾ ਨਾਂ ਹਰਮਨ ਹੈ").name).toBe("ਹਰਮਨ");
    expect(parseUtterance("ਮੇਰਾ ਨਾਂ ਹਰਮਨ ਸਿੰਘ ਹੈ ਜੀ").name).toBe("ਹਰਮਨ ਸਿੰਘ");
    expect(parseUtterance("मैं सिमरन हूँ").name).toBe("सिमरन");
    expect(parseUtterance("ਮੈਂ ਹਰਮਨ ਹਾਂ").name).toBe("ਹਰਮਨ");
    expect(parseUtterance("I'm Aman").name).toBe("Aman");
    expect(parseUtterance("नाम: सिमरन").name).toBe("सिमरन");
    expect(parseUtterance("मेरा नाम है सिमरन").name).toBe("सिमरन");
    expect(counsel({ text: "call me", language: "en", draft: { active: true }, now }).draft.name).toBeUndefined();
    expect(counsel({ text: "बेटी के लिए", language: "hi", draft: { active: true }, now }).draft.name).toBeUndefined();
  });

  it("R2-N3 accepts a natural yes and clears a named field", () => {
    const draft = {
      active: true,
      confirming: true,
      name: "सिमरन",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    expect(counsel({ text: "हाँ जी, भेज दो", language: "hi", draft, now }).ready).toBe(true);
    expect(counsel({ text: "ਹਾਂ ਜੀ ਭੇਜ ਦਿਓ", language: "pa", draft, now }).ready).toBe(true);
    expect(counsel({ text: "sure", language: "en", draft, now }).ready).toBe(true);
    expect(counsel({ text: "ok", language: "en", draft, now }).ready).toBe(true);
    expect(counsel({ text: "yes please", language: "en", draft, now }).ready).toBe(true);
    expect(counsel({ text: "sure, go ahead", language: "en", draft, now }).ready).toBe(true);
    const asked = counsel({ text: "नहीं", language: "hi", draft, now });
    expect(asked.ready).toBe(false);
    const phone = counsel({ text: "फोन", language: "hi", draft: asked.draft, now });
    expect(phone.draft.phone).toBeUndefined();
    expect(phone.reply).toContain("फोन");
    const punjabi = counsel({ text: "ਫੋਨ", language: "pa", draft: asked.draft, now });
    expect(punjabi.draft.phone).toBeUndefined();
  });

  it("R2-N4 answers an admission question without starting a booking", () => {
    const hindi = counsel({ text: "दाखिला कैसे होता है", language: "hi", now });
    expect(hindi.intent).toBe("admission");
    expect(hindi.ready).toBe(false);
    expect(hindi.draft.name).toBeUndefined();
    expect(hindi.reply).toContain("फीस");
    expect(hindi.reply).toContain("ट्रायल");
    expect(hindi.reply).toContain("जरूरी नहीं");
    const english = counsel({ text: "how to join", language: "en", now });
    expect(english.intent).toBe("admission");
    expect(english.ready).toBe(false);
    expect(english.reply.toLowerCase()).toContain("fee");
    expect(english.reply.toLowerCase()).toContain("trial");
    expect(english.reply.toLowerCase()).toContain("not required");
    expect(english.reply).toContain("₹1,500");
    expect(parseUtterance("ਦਾਖਲਾ ਕਿਵੇਂ ਹੁੰਦਾ ਹੈ").intent).toBe("admission");
    expect(parseUtterance("day after tomorrow", now).date).toBe("2026-11-02");
    expect(parseUtterance("परसों", now).date).toBe("2026-11-02");
    expect(parseUtterance("ਪਰਸੋਂ", now).date).toBe("2026-11-02");
  });

  it("B7 asks again when the date is not a batch day and names the next open day", () => {
    const reply = counsel({
      text: "8 November 2026",
      language: "en",
      draft: { active: true, name: "Aman Gill", phone: "9876543210", course: "ielts-pte", batch: "morning" },
      now,
    });
    expect(reply.ready).toBe(false);
    expect(reply.draft.date).toBeUndefined();
    expect(reply.reply).toMatch(/doesn't run/);
    expect(reply.reply).toMatch(/next open day/i);
  });

  it("R3-B2 answers eligibility in English, Hindi, and Punjabi", () => {
    const jee = getCourse("jee-foundation");
    const neet = getCourse("neet-foundation");
    expect(jee).toBeDefined();
    expect(neet).toBeDefined();

    const english = counsel({ text: "who is eligible for JEE?", language: "en", now });
    expect(english.intent).toBe("eligibility");
    expect(english.ready).toBe(false);
    expect(english.reply).toContain(jee?.eligibility);

    const hindi = counsel({ text: "NEET के लिए योग्यता", language: "hi", now });
    expect(hindi.intent).toBe("eligibility");
    expect(hindi.reply).toContain(neet?.eligibilityHi);

    const punjabi = counsel({ text: "JEE ਲਈ ਯੋਗਤਾ", language: "pa", now });
    expect(punjabi.intent).toBe("eligibility");
    expect(punjabi.reply).toContain(jee?.eligibilityPa);

    const afterTen = counsel({ text: "can I join after class 10?", language: "en", now });
    expect(afterTen.intent).toBe("eligibility");
    expect(afterTen.ready).toBe(false);
    expect(afterTen.reply.toLowerCase()).not.toContain("most students");
    expect(parseUtterance("NEET में कौन एडमिशन ले सकता है").intent).toBe("eligibility");
  });

  it("accepts जी हाँ भेज दीजिए and does not treat a status question as a booking", () => {
    const draft = {
      active: true,
      confirming: true,
      name: "सिमरन",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    expect(counsel({ text: "जी हाँ भेज दीजिए", language: "hi", draft, now }).ready).toBe(true);

    const status = counsel({ text: "is the booking confirmed?", language: "en", now });
    expect(status.intent).toBe("status");
    expect(status.ready).toBe(false);
    expect(status.draft.name).toBeUndefined();
    expect(status.reply.toLowerCase()).toContain("phone");
    expect(status.reply.toLowerCase()).not.toContain("what name");
  });

  it("rejects uncertain phrases as names and repeats the pending question", () => {
    for (const bad of ["not sure", "pata nahi", "पता नहीं", "ਪਤਾ ਨਹੀਂ"]) {
      const result = counsel({ text: bad, language: "en", draft: { active: true }, now });
      expect(result.draft.name).toBeUndefined();
    }
    const mid = counsel({
      text: "JEE के लिए योग्यता",
      language: "hi",
      draft: { active: true, name: "अमन" },
      now,
    });
    expect(mid.intent).toBe("eligibility");
    expect(mid.draft.name).toBe("अमन");
    expect(mid.reply).toContain("फोन");
    expect(mid.ready).toBe(false);
  });

  it("R4-B2 does not save a change request as the name", () => {
    const draft = {
      active: true,
      confirming: true,
      name: "सिमरन",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const hindi = counsel({ text: "हाँ पर नाम बदलना है", language: "hi", draft, now });
    expect(hindi.ready).toBe(false);
    expect(hindi.draft.name).toBe("सिमरन");
    expect(hindi.draft.confirming).toBe(false);
    expect(hindi.reply).toContain("क्या बदलना");
    expect(parseUtterance("हाँ पर नाम बदलना है").name).toBeNull();
    expect(parseUtterance("नाम बदलो").name).toBeNull();

    const again = counsel({ text: "नाम बदलो", language: "hi", draft, now });
    expect(again.ready).toBe(false);
    expect(again.draft.name).toBe("सिमरन");
    expect(again.reply).toContain("क्या बदलना");

    const punjabi = counsel({ text: "ਨਾਮ ਬਦਲਣਾ ਹੈ", language: "pa", draft, now });
    expect(punjabi.ready).toBe(false);
    expect(punjabi.draft.name).toBe("सिमरन");
    expect(punjabi.reply).toContain("ਕੀ ਬਦਲਣਾ");
    expect(parseUtterance("ਨਾਮ ਬਦਲਣਾ ਹੈ").name).toBeNull();

    const english = counsel({ text: "yes but change the name", language: "en", draft, now });
    expect(english.ready).toBe(false);
    expect(english.draft.name).toBe("सिमरन");
    expect(english.reply.toLowerCase()).toContain("which part");
  });

  it("starts a booking when eligibility words sit next to a booking request", () => {
    const booked = counsel({ text: "I can join the evening batch, book a trial", language: "en", now });
    expect(booked.intent).toBe("book");
    expect(booked.ready).toBe(false);
    expect(parseUtterance("who can join NEET?").intent).toBe("eligibility");
    expect(parseUtterance("who can I talk to about fees").intent).not.toBe("eligibility");
    const hindi = counsel({ text: "IELTS के लिए कौन योग्य है", language: "hi", now });
    expect(hindi.intent).toBe("eligibility");
    expect(hindi.reply).toContain(getCourse("ielts-pte")?.eligibilityHi);
    const punjabi = counsel({ text: "IELTS ਕੌਣ ਕਰ ਸਕਦਾ ਹੈ", language: "pa", now });
    expect(punjabi.intent).toBe("eligibility");
    expect(punjabi.reply).toContain(getCourse("ielts-pte")?.eligibilityPa);
  });

  it("refuses a same-day trial after that batch has ended", () => {
    const morning = counsel({
      text: "today",
      language: "en",
      draft: { active: true, name: "Aman Gill", phone: "9876543210", course: "jee-foundation", batch: "morning" },
      now,
    });
    expect(morning.ready).toBe(false);
    expect(morning.draft.date).toBeUndefined();
    expect(morning.draft.confirming).toBeFalsy();
    expect(morning.reply).toMatch(/already finished/);

    const evening = counsel({
      text: "today",
      language: "en",
      draft: { active: true, name: "Aman Gill", phone: "9876543210", course: "jee-foundation", batch: "evening" },
      now,
    });
    expect(evening.draft.date).toBe("2026-10-31");
    expect(evening.draft.confirming).toBe(true);
  });

  it("R7 translates booking errors for the Hindi form and keeps English as a fallback", () => {
    const duplicate = formServerMessage("hi", {
      error: "duplicate_phone",
      message: "This phone number already has a free trial class request today.",
    });
    expect(duplicate).toContain("आज पहले ही");
    expect(duplicate).not.toContain("already has");

    const phoneLimit = formServerMessage("hi", {
      error: "rate_limit",
      limit: "phone",
      message: "Too many attempts for this number. Wait ten minutes and try again.",
    });
    expect(phoneLimit).toContain("इस नंबर से बहुत कोशिशें");
    expect(phoneLimit).not.toContain("Too many");

    const connectionLimit = formServerMessage("hi", {
      error: "rate_limit",
      limit: "ip",
      message: "Too many attempts from this connection. Wait ten minutes and try again.",
    });
    expect(connectionLimit).toContain("इस कनेक्शन से बहुत कोशिशें");

    const weekday = formServerMessage("hi", {
      error: "invalid",
      fields: ["date"],
      dateReason: "weekday",
      message: "That batch doesn't run on that day.",
    });
    expect(weekday).toContain("बैच के दिन नहीं");
    expect(weekday).not.toContain("doesn't run");

    const ended = formServerMessage("hi", {
      error: "invalid",
      fields: ["date"],
      dateReason: "ended",
      message: "That batch has already finished today. Pick another day.",
    });
    expect(ended).toContain("खत्म हो चुका");

    const window = formServerMessage("hi", {
      error: "invalid",
      fields: ["date"],
      dateReason: "window",
      message: "Pick a date from today through the next 45 days.",
    });
    expect(window).toContain("45");
    expect(window).not.toContain("Pick a date");

    const english = formServerMessage("en", {
      error: "invalid",
      fields: ["date"],
      dateReason: "weekday",
      message: "That batch doesn't run on that day. Morning runs Mon–Fri.",
    });
    expect(english).toContain("doesn't run");
  });

  it("R7 does not take cancel words or hedges as a name, and a question is not a yes", () => {
    const started = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    for (const word of ["cancel", "stop", "रद्द"]) {
      const ended = counsel({ text: word, language: "en", draft: started, now });
      expect(ended.ready, word).toBe(false);
      expect(ended.draft.name, word).toBeUndefined();
      expect(ended.draft.course, word).toBeUndefined();
      expect(ended.reply.toLowerCase()).toMatch(/stopped|nothing|रोक|ਨਹੀਂ/);
    }
    for (const word of ["ruko", "रुको", "ਰੁਕੋ"]) {
      const waited = counsel({ text: word, language: "en", draft: started, now });
      expect(waited.ready, word).toBe(false);
      expect(waited.draft.name, word).toBe("Simran");
      expect(waited.draft.course, word).toBe("ielts-pte");
    }
    for (const word of ["cancel", "stop", "ruko", "रुको", "रद्द", "wait", "go ahead", "theek hai", "ok"]) {
      const named = counsel({ text: word, language: "en", draft: { active: true }, now });
      expect(named.draft.name, word).toBeUndefined();
    }
    const confirming = { ...started, confirming: true };
    for (const word of ["yes?", "sure?", "ok?"]) {
      const held = counsel({ text: word, language: "en", draft: confirming, now });
      expect(held.ready, word).toBe(false);
      expect(held.draft.confirming, word).toBe(true);
      expect(held.reply.toLowerCase()).toContain("yes");
    }
    expect(counsel({ text: "yes", language: "en", draft: confirming, now }).ready).toBe(true);
    expect(counsel({ text: "theek hai", language: "en", draft: confirming, now }).ready).toBe(true);
  });

  it("R7 answers a trial eligibility question and reads a name beside a weekday", () => {
    const asked = counsel({ text: "Is the trial class free for class 11?", language: "en", now });
    expect(asked.intent).toBe("eligibility");
    expect(asked.ready).toBe(false);
    expect(asked.draft.name).toBeUndefined();
    expect(asked.draft.active).toBeUndefined();
    expect(asked.reply.toLowerCase()).toContain("free");
    expect(asked.reply).toContain("class 11");
    expect(asked.reply.toLowerCase()).not.toContain("what name");

    const parsed = parseUtterance("Book IELTS morning trial for Tuesday. Simran, 9876543210", now);
    expect(parsed.name).toBe("Simran");
    expect(parsed.phone).toBe("9876543210");
    expect(parsed.date).toBe("2026-11-03");
    expect(parsed.courses).toEqual(["ielts-pte"]);
    expect(parsed.batch).toBe("morning");
    const booked = counsel({ text: "Book IELTS morning trial for Tuesday. Simran, 9876543210", language: "en", now });
    expect(booked.ready).toBe(false);
    expect(booked.draft.confirming).toBe(true);
    expect(booked.draft.name).toBe("Simran");
    expect(booked.draft.date).toBe("2026-11-03");
    expect(booked.draft.course).toBe("ielts-pte");
    expect(booked.draft.batch).toBe("morning");
  });

  it("R8 keeps junk in front of a phone from becoming the name", () => {
    const phone = "9876543210";
    const kept = { active: true, name: "Simran Kaur" };
    for (const phrase of [
      `call me at ${phone}`,
      `my number is ${phone}`,
      `thanks ${phone}`,
      `my son ${phone}`,
      `Phagwara ${phone}`,
      `करना ${phone}`,
      `कर दो ${phone}`,
      `मेरा ${phone}`,
      `कृपया ${phone}`,
      `ਕਰੋ ${phone}`,
      `ਜੀ ${phone}`,
    ]) {
      expect(parseUtterance(phrase, now).name, phrase).toBeNull();
      const result = counsel({ text: phrase, language: "en", draft: kept, now });
      expect(result.draft.name, phrase).toBe("Simran Kaur");
    }
    const cancelled = counsel({
      text: "कैंसल कर दो",
      language: "hi",
      draft: { active: true, name: "Simran", phone, course: "ielts-pte", batch: "morning" },
      now,
    });
    expect(cancelled.draft.name).toBeUndefined();
    expect(cancelled.draft.course).toBeUndefined();
    expect(cancelled.ready).toBe(false);
    expect(counsel({ text: "Simran Stopford", language: "en", draft: { active: true }, now }).draft.name).toBe("Simran Stopford");
    expect(parseUtterance("Book IELTS morning trial for Tuesday. Simran, 9876543210", now).name).toBe("Simran");
  });

  it("R8 answers eligibility from the class, and leaves timing and teachers alone", () => {
    const class8 = counsel({ text: "Is the trial free for class 8?", language: "en", now });
    expect(class8.intent).toBe("eligibility");
    expect(class8.draft.active).toBeUndefined();
    expect(class8.reply).toContain("Spoken English");
    expect(class8.reply).toContain("Class 8 and above");
    expect(class8.reply).not.toContain("JEE Foundation");

    const class9 = counsel({ text: "Is the trial free for class 9?", language: "en", now });
    expect(class9.reply).toContain("Punjab Board Tuition");
    expect(class9.reply).toContain("Spoken English");
    expect(class9.reply).not.toContain("JEE Foundation");

    const class10 = counsel({ text: "Is the trial free for class 10?", language: "en", now });
    expect(class10.reply).toContain("classes 9, 10, 11, or 12");
    expect(class10.reply).not.toContain("JEE Foundation");

    const class12 = counsel({ text: "Is the trial free for class 12?", language: "en", now });
    expect(class12.reply).toContain("IELTS");
    expect(class12.reply).toContain("JEE Foundation");
    expect(class12.reply).toContain("class 12");

    const timing = counsel({ text: "What time is the IELTS trial class?", language: "en", now });
    expect(timing.intent).toBe("batches");
    expect(timing.ready).toBe(false);
    expect(timing.draft.name).toBeUndefined();
    expect(timing.reply).toMatch(/7:00/);
    expect(timing.reply).not.toContain("For class 11");

    const teacher = counsel({ text: "Who teaches the IELTS trial class?", language: "en", now });
    expect(teacher.intent).not.toBe("book");
    expect(teacher.draft.active).toBeUndefined();
    expect(teacher.reply).toContain("Harleen Kaur");
    expect(teacher.reply).not.toContain("For class 11");

    const monday = counsel({ text: "Can I attend a trial class on Monday?", language: "en", now });
    expect(monday.intent).toBe("book");
    expect(monday.draft.date).toBe("2026-11-02");
    expect(monday.ready).toBe(false);
    expect(monday.reply.toLowerCase()).not.toContain("for class 11");
  });

  it("R8 confirms go ahead and picks the weekday tied to the booking", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    expect(counsel({ text: "go ahead", language: "en", draft: confirming, now }).ready).toBe(true);
    expect(counsel({ text: "आगे बढ़ो", language: "hi", draft: confirming, now }).ready).toBe(true);
    expect(parseUtterance("I can't come Monday, book the trial for Friday", now).date).toBe("2026-11-06");
    expect(parseUtterance("Book Monday, Friday is too late", now).date).toBe("2026-11-02");
  });

  it("R8 formats Punjabi dates without a garbled month and lists every failed field", () => {
    expect(formatLongDate("2026-11-03", "pa")).toBe("ਮੰਗਲ, 3 ਨਵੰਬਰ 2026");
    expect(formatLongDate("2026-11-03", "pa")).not.toContain("M11");
    const reply = savedBookingReply("pa", {
      id: "UA-TEST",
      name: "ਸਿਮਰਨ",
      course: "ielts-pte",
      batch: "morning",
      date: "2026-11-03",
    });
    expect(reply).toContain("ਨਵੰਬਰ");
    expect(reply).not.toContain("M11");
    const named = counsel({ text: "JEE fees", language: "hi", now });
    expect(named.reply).toContain("JEE फाउंडेशन");
    const punjabiCourse = counsel({ text: "JEE batches", language: "pa", now });
    expect(punjabiCourse.reply).toContain("JEE ਫਾਊਂਡੇਸ਼ਨ");
    const hindi = formServerMessage("hi", {
      error: "invalid",
      fields: ["phone", "date"],
      dateReason: "weekday",
      message: "Use a 10-digit mobile number. That batch doesn't run on that day.",
    });
    expect(hindi).toContain("दस अंक");
    expect(hindi).toContain("बैच के दिन नहीं");
  });

  it("R9 cancels only a short command and keeps the draft otherwise", () => {
    const mid = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    const confirming = { ...mid, confirming: true };
    const kept = [
      "don't cancel, book it",
      "don't stop, go ahead",
      "no need to cancel",
      "Is there a cancellation fee?",
      "Which bus stop is nearest?",
      "what if I need to cancel later?",
      "रद्द मत करो",
      "ਰੱਦ ਨਾ ਕਰੋ",
      "mat roko",
    ];
    for (const text of kept) {
      for (const draft of [mid, confirming]) {
        const result = counsel({ text, language: "en", draft, now });
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.course, text).toBe("ielts-pte");
      }
    }
    for (const text of ["cancel", "stop", "cancel it", "rehne do", "रद्द करो", "कैंसल कर दो", "ਰੱਦ ਕਰੋ"]) {
      const result = counsel({ text, language: "en", draft: confirming, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.ready, text).toBe(false);
    }
  });

  it("R9 lets an explicit name replace Simran, and ignores junk beside a phone", () => {
    const draft = { active: true, confirming: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    const phrases: Array<[string, string]> = [
      ["my name is Aman", "Aman"],
      ["change name to Harman", "Harman"],
      ["name: Priya", "Priya"],
      ["मेरा नाम अमन है", "अमन"],
      ["ਮੇਰਾ ਨਾਂ ਹਰਮਨ ਹੈ", "ਹਰਮਨ"],
      ["mera naam Simran hai", "Simran"],
    ];
    for (const [text, expected] of phrases) {
      const result = counsel({ text, language: "en", draft, now });
      if (expected === "Simran") {
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.pendingName, text).toBeUndefined();
      } else {
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.pendingName, text).toBe(expected);
        expect(result.ready, text).toBe(false);
      }
    }
    expect(counsel({ text: "Simran, 9876543210", language: "en", draft, now }).draft.name).toBe("Simran");
    const phone = "9876543210";
    for (const phrase of [`ਧੰਨਵਾਦ ${phone}`, `papa ${phone}`, `पापा का नंबर ${phone}`, `मम्मी ${phone}`, `ਮੇਰੇ ਪੁੱਤ ਦਾ ${phone}`]) {
      expect(parseUtterance(phrase, now).name, phrase).toBeNull();
      expect(counsel({ text: phrase, language: "en", draft: { active: true }, now }).draft.name, phrase).toBeUndefined();
    }
    expect(parseUtterance("mera naam Simran hai", now).name).toBe("Simran");
  });

  it("R9 answers trial questions and a Hindi teacher question without booking", () => {
    const class8 = counsel({ text: "Can a class 8 student attend the trial class?", language: "en", now });
    expect(class8.intent).not.toBe("book");
    expect(class8.draft.active).toBeUndefined();
    expect(class8.reply).toContain("Spoken English");
    expect(class8.reply.toLowerCase()).toContain("free");

    const free = counsel({ text: "Is the trial class free?", language: "en", now });
    expect(free.intent).not.toBe("book");
    expect(free.draft.name).toBeUndefined();
    expect(free.reply.toLowerCase()).toContain("free");

    const length = counsel({ text: "How long is the trial class?", language: "en", now });
    expect(length.intent).not.toBe("book");
    expect(length.draft.active).toBeUndefined();
    expect(length.reply.toLowerCase()).toContain("one free class");

    const teacher = counsel({ text: "IELTS कौन पढ़ाता है?", language: "hi", now });
    expect(teacher.intent).not.toBe("eligibility");
    expect(teacher.ready).toBe(false);
    expect(teacher.reply).toContain("हरलीन कौर");
    expect(teacher.reply).not.toContain("के लिए:");
  });

  it("R10 does not let a status line replace Simran, and keeps real compound names", () => {
    const simran = { active: true, confirming: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    for (const text of ["I am ready", "I am fine", "मैं तैयार हूँ", "ਮੈਂ ਤਿਆਰ ਹਾਂ", "ਮੈਂ ਠੀਕ ਹਾਂ", "mera naam kya hai"]) {
      expect(counsel({ text, language: "en", draft: simran, now }).draft.name, text).toBe("Simran");
    }
    expect(counsel({ text: "I am Aman", language: "en", draft: { active: true }, now }).draft.name).toBe("Aman");
    expect(counsel({ text: "I am Aman", language: "en", draft: simran, now }).draft.name).toBe("Simran");
    expect(counsel({ text: "name: Papa Singh", language: "en", draft: { active: true }, now }).draft.name).toBe("Papa Singh");
    expect(counsel({ text: "Bhai Mardana Singh", language: "en", draft: { active: true }, now }).draft.name).toBe("Bhai Mardana Singh");
    for (const [text, expected] of [
      ["name: Papa Singh", "Papa Singh"],
      ["the name is Karan", "Karan"],
      ["change the name to Jitesh", "Jitesh"],
    ] as const) {
      const renamed = counsel({ text, language: "en", draft: simran, now });
      expect(renamed.draft.name, text).toBe("Simran");
      expect(renamed.draft.pendingName, text).toBe(expected);
      expect(renamed.ready, text).toBe(false);
    }
    for (const text of ["uncle", "aunty", "नाना जी", "नानी", "दादा जी", "ਮਾਤਾ ਜੀ", "ਪਿਤਾ ਜੀ", "thanku", "thanku ji"]) {
      expect(counsel({ text, language: "en", draft: { active: true }, now }).draft.name, text).toBeUndefined();
    }
    expect(parseUtterance("मेरा नाम सिमरन है", now).name).toBe("सिमरन");
    expect(parseUtterance("ਮੇਰਾ ਨਾਂ ਸਿਮਰਨ ਹੈ", now).name).toBe("ਸਿਮਰਨ");
    expect(parseUtterance("I'm Simran Stopford", now).name).toBe("Simran Stopford");
  });

  it("R10 cancels ordinary booking cancels and still ignores guards", () => {
    const draft = { active: true, confirming: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    for (const text of [
      "Cancel.",
      "cancel!",
      "stop, cancel it",
      "cancel the booking",
      "cancel my booking",
      "cancel this",
      "stop the booking",
      "I want to cancel",
      "no, cancel",
      "कैंसल करो",
      "ਕੈਂਸਲ ਕਰੋ",
      "ਰੱਦ ਕਰ ਦਿਓ",
    ]) {
      const result = counsel({ text, language: "en", draft, now });
      expect(result.draft.name, text).toBeUndefined();
      expect(result.ready, text).toBe(false);
      expect(result.reply.toLowerCase(), text).not.toContain("which part");
    }
    const emptyName = counsel({ text: "कैंसल करो", language: "hi", draft: { active: true }, now });
    expect(emptyName.draft.name).toBeUndefined();
    for (const text of ["don't cancel", "can I cancel later?", "Which bus stop is nearest?"]) {
      expect(counsel({ text, language: "en", draft, now }).draft.name, text).toBe("Simran");
    }
  });

  it("R10 keeps a busy day from moving the trial and answers length and online", () => {
    const booked = counsel({
      text: "I'm busy Monday",
      language: "en",
      draft: { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning", date: "2026-11-20" },
      now,
    });
    expect(booked.draft.date).toBe("2026-11-20");
    expect(booked.draft.name).toBe("Simran");
    expect(parseUtterance("I'm busy Monday", now).date).toBeNull();

    const length = counsel({ text: "How long is the trial class?", language: "en", now });
    expect(length.intent).not.toBe("book");
    expect(length.reply.toLowerCase()).not.toContain("usual hour");
    expect(length.reply).toContain("1–4");

    for (const [text, language, online] of [
      ["Is the trial online?", "en", "not online"],
      ["क्या ट्रायल ऑनलाइन है?", "hi", "ऑनलाइन नहीं"],
      ["ਕੀ ਟਰਾਇਲ ਔਨਲਾਈਨ ਹੈ?", "pa", "ਔਨਲਾਈਨ ਨਹੀਂ"],
    ] as const) {
      const answer = counsel({ text, language, now });
      expect(answer.intent, text).not.toBe("book");
      expect(answer.draft.active, text).toBeUndefined();
      expect(answer.reply, text).toContain(online);
    }

    const fees = counsel({ text: "JEE fees", language: "hi", now });
    expect(fees.reply).toContain("मासिक");
    expect(fees.reply).not.toContain("(Monthly)");
    const punjabiFees = counsel({ text: "JEE fees", language: "pa", now });
    expect(punjabiFees.reply).toContain("ਮਹੀਨਾਵਾਰ");
    expect(punjabiFees.reply).not.toContain("(Monthly)");
    const teacher = counsel({ text: "Who teaches IELTS?", language: "pa", now });
    expect(teacher.reply).toContain("ਹਰਲੀਨ ਕੌਰ");
    expect(teacher.reply).not.toContain("Harleen Kaur");
  });

  it("R11 ignores confirmation words after a name phrase and still reads a real name", () => {
    const confirming = { active: true, confirming: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    const junk = [
      "the name is correct",
      "the name is right",
      "the name is perfect",
      "the name is mine",
      "the name is same",
      "name: correct",
      "मेरा नाम सही है",
      "मेरा नाम ठीक है",
      "ਮੇਰਾ ਨਾਂ ਸਹੀ ਹੈ",
      "ਮੇਰਾ ਨਾਂ ਠੀਕ ਹੈ",
    ];
    for (const text of junk) {
      expect(counsel({ text, language: "en", draft: confirming, now }).draft.name, text).toBe("Simran");
      expect(counsel({ text, language: "hi", draft: midway, now }).draft.name, text).toBe("Simran");
      expect(counsel({ text, language: "pa", draft: midway, now }).draft.name, text).toBe("Simran");
    }
    for (const draft of [confirming, midway]) {
      for (const [text, expected] of [
        ["the name is spelled Simran Kaur", "Simran Kaur"],
        ["my name is Simran Kaur only", "Simran Kaur"],
        ["मेरा नाम सिमरन ही है", "सिमरन"],
        ["ਮੇਰਾ ਨਾਂ ਸਿਮਰਨ ਹੀ ਹੈ", "ਸਿਮਰਨ"],
      ] as const) {
        const renamed = counsel({ text, language: "en", draft, now });
        expect(renamed.draft.name, text).toBe("Simran");
        expect(renamed.draft.pendingName, text).toBe(expected);
        expect(renamed.ready, text).toBe(false);
      }
    }
  });

  it("R11 answers side questions while booking, picks Tuesday after a busy Monday, and confirms ready", () => {
    const pendingDate = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    const online = counsel({ text: "Is the trial online?", language: "en", draft: pendingDate, now });
    expect(online.draft.name).toBe("Simran");
    expect(online.draft.date).toBeUndefined();
    expect(online.reply.toLowerCase()).toContain("not online");
    expect(online.reply.toLowerCase()).toContain("date");
    const length = counsel({ text: "How long is the trial class?", language: "hi", draft: pendingDate, now });
    expect(length.draft.course).toBe("ielts-pte");
    expect(length.reply).toContain("घंटे");
    expect(length.reply).toContain("तारीख");

    const tuesday = counsel({ text: "I'm busy Monday so Tuesday works", language: "en", draft: pendingDate, now });
    expect(tuesday.draft.date).toBe("2026-11-03");
    expect(tuesday.draft.name).toBe("Simran");

    const ready = { ...pendingDate, date: "2026-11-20", confirming: true };
    expect(counsel({ text: "I am ready", language: "en", draft: ready, now }).ready).toBe(true);
    expect(counsel({ text: "मैं तैयार हूँ", language: "hi", draft: ready, now }).ready).toBe(true);
    expect(counsel({ text: "ਮੈਂ ਤਿਆਰ ਹਾਂ", language: "pa", draft: ready, now }).ready).toBe(true);
    expect(counsel({ text: "I am ready", language: "en", draft: ready, now }).draft.name).toBe("Simran");
    expect(counsel({ text: "I am ready", language: "en", draft: ready, now }).reply.toLowerCase()).not.toContain("which part");

    for (const text of ["cancel the trial", "cancel karo", "बुकिंग कैंसल करो", "रद्द कर दीजिए"]) {
      expect(counsel({ text, language: "en", draft: ready, now }).draft.name, text).toBeUndefined();
    }
    expect(counsel({ text: "don't cancel the trial", language: "en", draft: ready, now }).draft.name).toBe("Simran");

    const asked = counsel({
      text: "What is the fee? My name is Aman",
      language: "en",
      draft: { active: true, course: "ielts-pte" },
      now,
    });
    expect(asked.draft.name).toBe("Aman");
    expect(asked.reply).toMatch(/₹|fee/i);
    expect(asked.ready).toBe(false);

    const saturday = counsel({ text: "Is the NEET trial on Saturday?", language: "en", now });
    expect(saturday.intent).not.toBe("book");
    expect(saturday.draft.date).toBeUndefined();
    expect(saturday.draft.active).toBeUndefined();
    expect(saturday.reply.toLowerCase()).toContain("neet");
    expect(formatBatchTime("7:00–9:00 am", "hi")).not.toMatch(/\bam\b/i);
    expect(formatBatchTime("5:00–7:00 pm", "pa")).not.toMatch(/\bpm\b/i);
    expect(formatBatchTime("7:00–9:00 am", "hi")).toContain("सुबह");
    expect(formatBatchTime("5:00–7:00 pm", "pa")).toContain("ਵਜੇ");
  });

  it("R12 confirms a different name before replacing it and ignores meta-only captures", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    const meta = [
      "the name is correct",
      "the name is correct now",
      "the name is spelled correctly",
      "the name is correct spelling",
      "the name is all correct",
      "the name is absolutely correct",
      "the name is exactly right",
      "my name is already there",
    ];
    for (const text of meta) {
      expect(parseUtterance(text, now).name, text).toBeNull();
      const atConfirm = counsel({ text, language: "en", draft: confirming, now });
      expect(atConfirm.draft.name, text).toBe("Simran");
      expect(atConfirm.draft.pendingName, text).toBeUndefined();
      expect(atConfirm.ready, text).toBe(true);
      expect(atConfirm.reply.toLowerCase(), text).not.toContain("which part");
      expect(atConfirm.reply, text).not.toContain("Shall I send");
      const during = counsel({ text, language: "en", draft: midway, now });
      expect(during.draft.name, text).toBe("Simran");
      expect(during.draft.pendingName, text).toBeUndefined();
      expect(during.draft.course, text).toBe("ielts-pte");
      expect(during.draft.date, text).toBeUndefined();
      expect(during.ready, text).toBe(false);
      expect(during.reply.toLowerCase(), text).toContain("date");
      expect(during.reply, text).not.toMatch(/couldn.t read that date/i);
    }

    const empty = { active: true };
    const legit: Array<[string, string]> = [
      ["my name is Simran Kaur", "Simran Kaur"],
      ["मेरा नाम सिमरन कौर है", "सिमरन कौर"],
      ["ਮੇਰਾ ਨਾਂ ਸਿਮਰਨ ਕੌਰ ਹੈ", "ਸਿਮਰਨ ਕੌਰ"],
      ["my name is Simran Kaur only", "Simran Kaur"],
      ["spelled Simran Kaur", "Simran Kaur"],
      ["Simran Stopford", "Simran Stopford"],
      ["the name is Jitesh", "Jitesh"],
      ["the name is Karan", "Karan"],
      ["name: Papa Singh", "Papa Singh"],
      ["name: Bhai Mardana Singh", "Bhai Mardana Singh"],
      ["name: Sameer", "Sameer"],
      ["name: Mina", "Mina"],
      ["name: Wright", "Wright"],
      ["name: Sahi Ram", "Sahi Ram"],
      ["name: सही राम", "सही राम"],
      ["name: Perfecto Singh", "Perfecto Singh"],
      ["name: ਸਹਿਜ", "ਸਹਿਜ"],
      ["name: Fine Singh", "Fine Singh"],
      ["name: Okay Kumar", "Okay Kumar"],
      ["name: Mona Wrong", "Mona Wrong"],
      ["name: Kya Singh", "Kya Singh"],
    ];
    for (const [text, expected] of legit) {
      expect(counsel({ text, language: "en", draft: empty, now }).draft.name, text).toBe(expected);
    }
    expect(parseUtterance("my name is Fine Singh", now).name).toBe("Fine Singh");
    expect(counsel({ text: "my name is Fine Singh", language: "en", draft: empty, now }).draft.name).toBe("Fine Singh");
    const mixedRename = counsel({ text: "my name is Fine Singh", language: "en", draft: confirming, now });
    expect(mixedRename.draft.name).toBe("Simran");
    expect(mixedRename.draft.pendingName).toBe("Fine Singh");
    expect(mixedRename.ready).toBe(false);

    for (const draft of [confirming, midway]) {
      const pending = counsel({ text: "my name is Simran Kaur", language: "en", draft, now });
      expect(pending.draft.name).toBe("Simran");
      expect(pending.draft.pendingName).toBe("Simran Kaur");
      expect(pending.ready).toBe(false);
      expect(pending.reply).toContain("Change the name to 'Simran Kaur'?");
    }

    const asked = counsel({ text: "name: Fine Singh", language: "en", draft: confirming, now });
    expect(asked.draft.name).toBe("Simran");
    expect(asked.draft.pendingName).toBe("Fine Singh");
    expect(asked.ready).toBe(false);
    const refused = counsel({ text: "no", language: "en", draft: asked.draft, now });
    expect(refused.draft.name).toBe("Simran");
    expect(refused.draft.pendingName).toBeUndefined();
    expect(refused.draft.date).toBe("2026-11-20");
    expect(refused.ready).toBe(false);
    expect(refused.draft.confirming).toBe(true);

    const again = counsel({ text: "name: Fine Singh", language: "en", draft: confirming, now });
    const accepted = counsel({ text: "yes", language: "en", draft: again.draft, now });
    expect(accepted.draft.name).toBe("Fine Singh");
    expect(accepted.draft.pendingName).toBeUndefined();
    expect(accepted.ready).toBe(false);
    expect(accepted.draft.confirming).toBe(true);
    expect(counsel({ text: "yes", language: "en", draft: accepted.draft, now }).ready).toBe(true);

    const hindiAsk = counsel({ text: "मेरा नाम अमन है", language: "hi", draft: confirming, now });
    expect(hindiAsk.reply).toContain("नाम बदल कर 'अमन' कर दूँ?");
    expect(hindiAsk.ready).toBe(false);
    const hindiNo = counsel({ text: "नहीं", language: "hi", draft: hindiAsk.draft, now });
    expect(hindiNo.draft.name).toBe("Simran");
    expect(hindiNo.draft.pendingName).toBeUndefined();
    expect(hindiNo.ready).toBe(false);
    const hindiYes = counsel({ text: "हाँ", language: "hi", draft: hindiAsk.draft, now });
    expect(hindiYes.draft.name).toBe("अमन");
    expect(hindiYes.ready).toBe(false);
    expect(counsel({ text: "हाँ", language: "hi", draft: hindiYes.draft, now }).ready).toBe(true);

    const punjabiAsk = counsel({ text: "ਮੇਰਾ ਨਾਂ ਹਰਮਨ ਹੈ", language: "pa", draft: midway, now });
    expect(punjabiAsk.reply).toContain("ਨਾਮ ਬਦਲ ਕੇ 'ਹਰਮਨ' ਕਰ ਦਿਆਂ?");
    expect(punjabiAsk.draft.name).toBe("Simran");
    expect(punjabiAsk.draft.date).toBeUndefined();
    const punjabiNo = counsel({ text: "ਨਹੀਂ", language: "pa", draft: punjabiAsk.draft, now });
    expect(punjabiNo.draft.name).toBe("Simran");
    expect(punjabiNo.draft.pendingName).toBeUndefined();
    expect(punjabiNo.draft.batch).toBe("morning");
    const drifted = counsel({ text: "tomorrow", language: "en", draft: punjabiAsk.draft, now });
    expect(drifted.draft.name).toBe("Simran");
    expect(drifted.draft.date).toBeUndefined();
    expect(drifted.draft.pendingName).toBe("ਹਰਮਨ");
    expect(drifted.reply).toContain("ਹਰਮਨ");
    const punjabiYes = counsel({ text: "ਹਾਂ", language: "pa", draft: punjabiAsk.draft, now });
    expect(punjabiYes.draft.name).toBe("ਹਰਮਨ");
    expect(punjabiYes.ready).toBe(false);
    expect(punjabiYes.reply).toContain("ਤਾਰੀਖ");

    const ready = counsel({ text: "I am ready", language: "en", draft: { ...confirming, pendingName: "Aman" }, now });
    expect(ready.ready).toBe(false);
    expect(ready.draft.name).toBe("Simran");
    expect(ready.draft.pendingName).toBe("Aman");
    expect(ready.reply).toContain("Change the name to 'Aman'?");
  });

  it("R12 leaves an open draft alone for trial questions and answers what the class covers", () => {
    const pendingDate = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    const questions = [
      "Is the NEET trial class on Saturday?",
      "Does the NEET trial run on Saturday?",
      "What time is the NEET trial?",
      "kya is the NEET trial on Saturday",
      "क्या NEET ट्रायल शनिवार को है?",
      "ਕੀ NEET ਟਰਾਇਲ ਸ਼ਨੀਵਾਰ ਨੂੰ ਹੈ?",
      "Book a NEET trial on Saturday?",
    ];
    for (const text of questions) {
      const answer = counsel({ text, language: "en", draft: pendingDate, now });
      expect(answer.draft.course, text).toBe("ielts-pte");
      expect(answer.draft.batch, text).toBe("morning");
      expect(answer.draft.date, text).toBeUndefined();
      expect(answer.draft.name, text).toBe("Simran");
      expect(answer.ready, text).toBe(false);
      expect(answer.reply, text).not.toMatch(/couldn.t read that date|तारीख समझ नहीं|ਤਾਰੀਖ ਸਮਝ ਨਹੀਂ/i);
      expect(answer.reply, text).not.toMatch(/already finished|खत्म हो चुका है|ਖਤਮ ਹੋ ਚੁੱਕਾ/);
    }

    const named = counsel({
      text: "name: Navjot Kaur. Is the trial online?",
      language: "en",
      draft: { active: true, course: "ielts-pte" },
      now,
    });
    expect(named.draft.name).toBe("Navjot Kaur");
    expect(named.draft.course).toBe("ielts-pte");
    expect(named.draft.date).toBeUndefined();
    expect(named.reply.toLowerCase()).toContain("not online");
    expect(named.ready).toBe(false);

    const happens = counsel({ text: "What happens in the trial class?", language: "en", now });
    expect(happens.reply).toContain("Weekly mock test");
    expect(happens.reply).toContain("NCERT-first biology hours");
    expect(happens.reply).not.toMatch(/7:00|morning batch/);
    expect(happens.reply).not.toMatch(/covers\./);
    const happensPa = counsel({ text: "What happens in the trial class?", language: "pa", now });
    expect(happensPa.reply).toContain("ਹਰ ਹਫ਼ਤੇ ਮੌਕ ਟੈਸਟ");
    expect(happensPa.reply).not.toContain("Weekly mock test");
    expect(happens.draft.active).toBeUndefined();
    const happensMid = counsel({ text: "What happens in the trial class?", language: "en", draft: pendingDate, now });
    expect(happensMid.draft.course).toBe("ielts-pte");
    expect(happensMid.draft.date).toBeUndefined();
    expect(happensMid.reply).toContain("Weekly mock test");
    expect(happensMid.reply).not.toMatch(/couldn.t read that date/i);

    const openEvening = counsel({ text: "Book a NEET trial on Saturday", language: "en", now });
    expect(openEvening.draft.date).toBe("2026-10-31");
    const late = new Date("2026-10-31T13:00:00.000Z");
    const ended = counsel({ text: "Book a NEET trial on Saturday", language: "en", now: late });
    expect(ended.draft.date).toBeUndefined();
    expect(ended.draft.course).toBe("neet-foundation");
    expect(ended.reply).toContain("already finished today");
    expect(ended.reply).toContain(formatLongDate("2026-11-01", "en"));
    expect(ended.reply.toLowerCase()).toContain("weekend");
    expect(ended.reply.toLowerCase()).toContain("another course");
    expect(ended.reply).not.toContain("2026-10-31");

    const tuesdayHi = counsel({ text: "सोमवार को व्यस्त हूँ तो मंगलवार", language: "hi", draft: pendingDate, now });
    expect(tuesdayHi.draft.date).toBe("2026-11-03");
    expect(tuesdayHi.draft.course).toBe("ielts-pte");
    const tuesdayPa = counsel({ text: "ਸੋਮਵਾਰ ਨੂੰ ਵਿਅਸਤ ਹਾਂ ਤਾਂ ਮੰਗਲਵਾਰ", language: "pa", draft: pendingDate, now });
    expect(tuesdayPa.draft.date).toBe("2026-11-03");
    expect(tuesdayPa.draft.course).toBe("ielts-pte");

    expect(formatBatchTime("7:00–9:00 am", "en")).toBe("7:00 to 9:00 in the morning");
    expect(formatBatchTime("7:00–9:00 am", "en")).not.toMatch(/\bam\b/i);
    expect(formatBatchTime("5:00–7:00 pm", "en")).not.toMatch(/\bpm\b/i);
    expect(formatBatchTime("9:00 am–1:00 pm", "en")).not.toMatch(/\b(?:am|pm)\b/i);

    const cancelling = { ...pendingDate, date: "2026-11-20", confirming: true };
    for (const text of [
      "ਬੁਕਿੰਗ ਰੱਦ ਕਰੋ",
      "cancel the request",
      "nahi, cancel",
      "forget it",
      "just cancel",
      "ok cancel",
      "I would like to cancel",
    ]) {
      const endedDraft = counsel({ text, language: "en", draft: cancelling, now });
      expect(endedDraft.draft.name, text).toBeUndefined();
      expect(endedDraft.ready, text).toBe(false);
    }
    expect(counsel({ text: "I am ready", language: "en", draft: cancelling, now }).ready).toBe(true);
  });

  it("R13 does not send a booking when a confirmation is only part of the message", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const phrases: Array<[string, "en" | "hi" | "pa", "cancel" | "batch" | "phone" | "name"]> = [
      ["the name is correct. cancel", "en", "cancel"],
      ["मेरा नाम सही है। रद्द करो", "hi", "cancel"],
      ["ਮੇਰਾ ਨਾਂ ਸਹੀ ਹੈ। ਰੱਦ ਕਰੋ", "pa", "cancel"],
      ["the name is correct. Change the batch to evening", "en", "batch"],
      ["मेरा नाम सही है। बैच शाम का कर दो", "hi", "batch"],
      ["ਮੇਰਾ ਨਾਂ ਸਹੀ ਹੈ। ਬੈਚ ਸ਼ਾਮ ਦਾ ਕਰੋ", "pa", "batch"],
      ["my name is correct, change phone to 9876501234", "en", "phone"],
      ["मेरा नाम सही है, फोन 9876501234 कर दो", "hi", "phone"],
      ["ਮੇਰਾ ਨਾਂ ਸਹੀ ਹੈ, ਫੋਨ 9876501234 ਕਰੋ", "pa", "phone"],
      ["Change the name to correct now", "en", "name"],
      ["change name to right", "en", "name"],
      ["नाम बदल कर सही करो", "hi", "name"],
      ["ਨਾਮ ਬਦਲ ਕੇ ਸਹੀ ਕਰੋ", "pa", "name"],
    ];
    for (const [text, language, kind] of phrases) {
      const result = counsel({ text, language, draft: confirming, now });
      expect(result.ready, text).toBe(false);
      expect(result.reply, text).not.toMatch(/sending|भेज रही|ਭੇਜ ਰਹੀ/i);
      if (kind === "cancel") {
        expect(result.draft.name, text).toBeUndefined();
        expect(result.draft.phone, text).toBeUndefined();
      } else if (kind === "batch") {
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.batch, text).toBe("evening");
        expect(result.draft.phone, text).toBe("9876543210");
        expect(result.draft.confirming, text).toBe(true);
      } else if (kind === "phone") {
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.phone, text).toBe("9876501234");
        expect(result.draft.batch, text).toBe("morning");
        expect(result.draft.confirming, text).toBe(true);
      } else {
        expect(result.draft.name, text).toBe("Simran");
        expect(result.draft.phone, text).toBe("9876543210");
        expect(result.draft.batch, text).toBe("morning");
      }
    }

    for (const text of ["all correct", "exactly right", "sab sahi", "ji haan", "जी हाँ", "ਹਾਂ ਜੀ"]) {
      const yes = counsel({ text, language: "en", draft: confirming, now });
      expect(yes.ready, text).toBe(true);
      expect(yes.draft.name, text).toBe("Simran");
      expect(yes.draft.batch, text).toBe("morning");
    }
  });

  it("R13 keeps a real name after filler words and asks again when the name is wrong", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    for (const draft of [confirming, midway]) {
      for (const text of ["my name is now Aman Gill", "change the name to Aman Gill now"]) {
        const renamed = counsel({ text, language: "en", draft, now });
        expect(renamed.draft.name, text).toBe("Simran");
        expect(renamed.draft.pendingName, text).toBe("Aman Gill");
        expect(renamed.ready, text).toBe(false);
        expect(renamed.reply, text).toContain("Change the name to 'Aman Gill'?");
        expect(renamed.reply.toLowerCase(), text).not.toContain("which part");
        expect(renamed.reply, text).not.toMatch(/couldn.t read that date/i);
      }
    }

    const wrong = [
      "the name is wrong",
      "the name is misspelled",
      "the name is not right",
      "incorrect",
      "मेरा नाम गलत है",
      "ਮੇਰਾ ਨਾਮ ਗਲਤ ਹੈ",
    ];
    for (const language of ["en", "hi", "pa"] as const) {
      const ask = language === "hi" ? "सही नाम क्या है?" : language === "pa" ? "ਸਹੀ ਨਾਂ ਕੀ ਹੈ?" : "What is the correct name?";
      for (const text of wrong) {
        const atConfirm = counsel({ text, language, draft: confirming, now });
        expect(atConfirm.ready, `${language} ${text}`).toBe(false);
        expect(atConfirm.draft.name, `${language} ${text}`).toBeUndefined();
        expect(atConfirm.draft.confirming, `${language} ${text}`).toBe(false);
        expect(atConfirm.reply, `${language} ${text}`).toContain(ask);
        expect(atConfirm.reply, `${language} ${text}`).not.toMatch(/Shall I send|भेज दूँ|ਭੇਜ ਦਿਆਂ/);
        const during = counsel({ text, language, draft: midway, now });
        expect(during.ready, `${language} mid ${text}`).toBe(false);
        expect(during.draft.name, `${language} mid ${text}`).toBeUndefined();
        expect(during.reply, `${language} mid ${text}`).toContain(ask);
        expect(during.reply, `${language} mid ${text}`).not.toMatch(/couldn.t read that date|तारीख समझ नहीं|ਤਾਰੀਖ ਸਮਝ ਨਹੀਂ/);
        const blocked = counsel({ text: "yes", language, draft: atConfirm.draft, now });
        expect(blocked.ready, `${language} ${text} yes`).toBe(false);
      }
    }

    const pending = counsel({ text: "my name is Aman Gill", language: "en", draft: confirming, now });
    const dated = counsel({ text: "Tuesday", language: "en", draft: pending.draft, now });
    expect(dated.draft.name).toBe("Simran");
    expect(dated.draft.pendingName).toBe("Aman Gill");
    expect(dated.draft.date).toBe("2026-11-03");
    expect(dated.reply).toContain("Aman Gill");
    expect(dated.ready).toBe(false);
    const phoned = counsel({ text: "9876501234", language: "en", draft: pending.draft, now });
    expect(phoned.draft.phone).toBe("9876501234");
    expect(phoned.draft.name).toBe("Simran");
    expect(phoned.draft.pendingName).toBe("Aman Gill");
    expect(phoned.ready).toBe(false);
    const batched = counsel({ text: "evening", language: "en", draft: pending.draft, now });
    expect(batched.draft.batch).toBe("evening");
    expect(batched.draft.name).toBe("Simran");
    expect(batched.draft.pendingName).toBe("Aman Gill");
    const asked = counsel({ text: "Is the trial online?", language: "en", draft: pending.draft, now });
    expect(asked.draft.name).toBe("Simran");
    expect(asked.draft.pendingName).toBe("Aman Gill");
    expect(asked.reply.toLowerCase()).toContain("not online");
    expect(asked.reply).toContain("Aman Gill");
    expect(asked.ready).toBe(false);

    const fresh = counsel({ text: "name: Navjot Kaur. Is the trial online?", language: "en", now });
    expect(fresh.draft.name).toBe("Navjot Kaur");
    expect(fresh.reply.toLowerCase()).toContain("not online");
    expect(fresh.ready).toBe(false);

    const cancelled = counsel({ text: "actually cancel", language: "en", draft: confirming, now });
    expect(cancelled.draft.name).toBeUndefined();
    expect(cancelled.ready).toBe(false);
    expect(counsel({ text: "don't cancel the trial", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
    expect(counsel({ text: "can I cancel later?", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
    expect(counsel({ text: "no need to cancel", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
  });

  it("R14 does not book the old name when the rename question is answered with a confirm word", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    const yesWords = ["correct", "right", "fine", "same", "the name is correct", "सही", "ਸਹੀ", "all correct", "looks good", "send"];
    for (const language of ["en", "hi", "pa"] as const) {
      const summary = language === "hi" ? "भेज दूँ" : language === "pa" ? "ਭੇਜ ਦਿਆਂ" : "Shall I send";
      for (const start of [confirming, midway]) {
        const atConfirm = "confirming" in start && start.confirming;
        const asked = counsel({ text: "my name is Aman Gill", language, draft: start, now });
        expect(asked.draft.pendingName, language).toBe("Aman Gill");
        expect(asked.ready, language).toBe(false);
        for (const text of yesWords) {
          const answered = counsel({ text, language, draft: asked.draft, now });
          expect(answered.ready, `${language} ${text}`).toBe(false);
          expect(answered.draft.name, `${language} ${text}`).toBe("Aman Gill");
          expect(answered.draft.pendingName, `${language} ${text}`).toBeUndefined();
          expect(answered.reply, `${language} ${text}`).not.toMatch(/sending|भेज रही|ਭੇਜ ਰਹੀ/);
          if (atConfirm) expect(answered.reply, `${language} ${text}`).toContain(summary);
          else expect(answered.reply.toLowerCase(), `${language} ${text}`).toMatch(/date|तारीख|ਤਾਰੀਖ/);
        }
        for (const text of ["keep it", "the old one", "no", "nahi", "नहीं", "ਨਹੀਂ"]) {
          const kept = counsel({ text, language, draft: asked.draft, now });
          expect(kept.ready, `${language} ${text}`).toBe(false);
          expect(kept.draft.name, `${language} ${text}`).toBe("Simran");
          expect(kept.draft.pendingName, `${language} ${text}`).toBeUndefined();
          if (atConfirm) expect(kept.reply, `${language} ${text}`).toContain(summary);
        }
        const again = counsel({ text: "hello", language, draft: asked.draft, now });
        expect(again.ready, language).toBe(false);
        expect(again.draft.name, language).toBe("Simran");
        expect(again.draft.pendingName, language).toBe("Aman Gill");
        expect(again.reply, language).toContain("Aman Gill");
        const retyped = counsel({ text: "Aman Gill", language, draft: asked.draft, now });
        expect(retyped.ready, language).toBe(false);
        expect(retyped.draft.name, language).toBe("Aman Gill");
        expect(retyped.draft.pendingName, language).toBeUndefined();
      }
    }
  });

  it("R14 keeps weak words from sending, and handles the other confirm polish", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    for (const text of ["spelling", "only", "there", "all", "mine"]) {
      const result = counsel({ text, language: "en", draft: confirming, now });
      expect(result.ready, text).toBe(false);
      expect(result.draft.name, text).toBe("Simran");
      expect(result.draft.confirming, text).toBe(true);
      expect(result.reply, text).toContain("Shall I send");
    }
    for (const text of ["looks good", "all good", "that is correct", "सब सही है"]) {
      expect(counsel({ text, language: "en", draft: confirming, now }).ready, text).toBe(true);
    }
    for (const [text, language, ask] of [
      ["wrong", "en", "Which part is wrong?"],
      ["galat", "en", "Which part is wrong?"],
      ["wrong", "hi", "कौन सी बात गलत है?"],
      ["galat", "pa", "ਕਿਹੜੀ ਗੱਲ ਗਲਤ ਹੈ?"],
    ] as const) {
      const result = counsel({ text, language, draft: confirming, now });
      expect(result.ready, text).toBe(false);
      expect(result.draft.name, text).toBe("Simran");
      expect(result.reply, text).toContain(ask);
    }
    for (const [text, language, ask] of [
      ["नाम गलत है", "hi", "सही नाम क्या है?"],
      ["ਨਾਂ ਗਲਤ ਹੈ", "pa", "ਸਹੀ ਨਾਂ ਕੀ ਹੈ?"],
    ] as const) {
      const result = counsel({ text, language, draft: confirming, now });
      expect(result.ready, text).toBe(false);
      expect(result.draft.name, text).toBeUndefined();
      expect(result.reply, text).toContain(ask);
      expect(result.reply, text).not.toMatch(/Shall I send|भेज दूँ|ਭੇਜ ਦਿਆਂ/);
    }
    expect(counsel({ text: "my name is अब Aman Gill", language: "en", draft: { active: true }, now }).draft.name).toBe("Aman Gill");
    expect(counsel({ text: "my name is ਹੁਣ Aman Gill", language: "en", draft: { active: true }, now }).draft.name).toBe("Aman Gill");
    for (const text of ["my name is fine thanks", "my name is given", "my name is right here", "my name is same as before", "my name is correct plus evening batch", "hold on"]) {
      expect(counsel({ text, language: "en", draft: { active: true }, now }).draft.name, text).toBeUndefined();
    }
    const moved = counsel({ text: "evening", language: "en", draft: midway, now });
    expect(moved.draft.batch).toBe("evening");
    expect(moved.reply).toContain("Which date works?");
    expect(moved.reply).not.toMatch(/couldn.t read that date/);
    const phoned = counsel({ text: "change phone to 9876501234", language: "en", draft: midway, now });
    expect(phoned.draft.phone).toBe("9876501234");
    expect(phoned.reply).toContain("Which date works?");
    expect(phoned.reply).not.toMatch(/couldn.t read that date/);
    for (const text of ["all correct and cancel", "yes cancel", "correct\ncancel"]) {
      const ended = counsel({ text, language: "en", draft: confirming, now });
      expect(ended.draft.name, text).toBeUndefined();
      expect(ended.ready, text).toBe(false);
    }
    const free = counsel({ text: "name: Navjot Kaur. Is the trial free?", language: "en", now });
    expect(free.draft.name).toBe("Navjot Kaur");
    expect(free.reply.toLowerCase()).toContain("free");
    expect(free.ready).toBe(false);
    const shaam = counsel({ text: "sahi hai, shaam ka batch", language: "en", draft: confirming, now });
    expect(shaam.ready).toBe(false);
    expect(shaam.draft.batch).toBe("evening");
    expect(shaam.draft.name).toBe("Simran");
    expect(shaam.draft.confirming).toBe(true);
    expect(shaam.reply).toContain("Shall I send");
    expect(counsel({ text: "don't cancel", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
    expect(counsel({ text: "can I cancel later?", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
  });

  it("R15 keeps Sham-style names out of the evening batch", () => {
    const names = ["Sham Singh", "Sham Lal", "Sham Sundar", "शाम लाल", "ਸ਼ਾਮ ਲਾਲ"];
    for (const name of names) {
      const started = counsel({ text: "Book an IELTS trial", language: "en", now });
      expect(started.draft.batch, name).toBeUndefined();
      const bare = counsel({ text: name, language: "en", draft: started.draft, now });
      expect(bare.draft.name, `bare ${name}`).toBe(name);
      expect(bare.draft.batch, `bare ${name}`).toBeUndefined();
      expect(bare.reply.toLowerCase(), `bare ${name}`).toMatch(/phone|फोन|ਫੋਨ/);

      const stated = counsel({ text: `my name is ${name}`, language: "en", draft: started.draft, now });
      expect(stated.draft.name, `my name ${name}`).toBe(name);
      expect(stated.draft.batch, `my name ${name}`).toBeUndefined();

      const introduced = counsel({ text: `Book an IELTS trial for ${name}, 9876543210`, language: "en", now });
      expect(introduced.draft.name, `for ${name}`).toBe(name);
      expect(introduced.draft.phone, `for ${name}`).toBe("9876543210");
      expect(introduced.draft.batch, `for ${name}`).toBeUndefined();
      expect(introduced.reply.toLowerCase(), `for ${name}`).toMatch(/batch|बैच|ਬੈਚ/);

      const prefixed = counsel({ text: `I am ${name}`, language: "en", draft: started.draft, now });
      expect(prefixed.draft.name, `I am ${name}`).toBe(name);
      expect(prefixed.draft.name, `I am ${name}`).not.toMatch(/^I am /);
      expect(prefixed.draft.batch, `I am ${name}`).toBeUndefined();
    }

    const hindi = counsel({ text: "मेरा नाम शाम लाल है", language: "hi", draft: { active: true }, now });
    expect(hindi.draft.name).toBe("शाम लाल");
    expect(hindi.draft.batch).toBeUndefined();

    let ticket = counsel({ text: "Book an IELTS trial", language: "en", now }).draft;
    ticket = counsel({ text: "Sham Singh", language: "en", draft: ticket, now }).draft;
    ticket = counsel({ text: "9876543210", language: "en", draft: ticket, now }).draft;
    const dated = counsel({ text: "3 November", language: "en", draft: ticket, now });
    expect(dated.draft.name).toBe("Sham Singh");
    expect(dated.draft.batch).toBeUndefined();
    expect(dated.draft.date).toBe("2026-11-03");
    expect(dated.reply.toLowerCase()).toMatch(/batch/);
    expect(dated.ready).toBe(false);

    const shaam = counsel({ text: "sahi hai, shaam ka batch", language: "en", draft: { active: true, confirming: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const, date: "2026-11-20" }, now });
    expect(shaam.draft.batch).toBe("evening");
    expect(shaam.ready).toBe(false);
  });

  it("R15 handles cancel parts, rename follow-ups, and the remaining polish", () => {
    const confirming = {
      active: true,
      confirming: true,
      name: "Simran",
      phone: "9876543210",
      course: "ielts-pte",
      batch: "morning" as const,
      date: "2026-11-20",
    };
    const midway = { active: true, name: "Simran", phone: "9876543210", course: "ielts-pte", batch: "morning" as const };
    expect(counsel({ text: "stop and think", language: "en", draft: confirming, now }).draft.name).toBe("Simran");
    const movedDate = counsel({ text: "do not cancel and change date to 5 November", language: "en", draft: confirming, now });
    expect(movedDate.draft.name).toBe("Simran");
    expect(movedDate.draft.date).toBe("2026-11-05");
    expect(movedDate.ready).toBe(false);
    const questioned = counsel({ text: "cancel? no and evening", language: "en", draft: confirming, now });
    expect(questioned.draft.name).toBe("Simran");
    expect(questioned.draft.batch).toBe("evening");
    expect(questioned.ready).toBe(false);

    const pending = counsel({ text: "my name is Aman Gill", language: "en", draft: confirming, now });
    const both = counsel({ text: "correct and evening batch", language: "en", draft: pending.draft, now });
    expect(both.ready).toBe(false);
    expect(both.draft.name).toBe("Aman Gill");
    expect(both.draft.batch).toBe("evening");
    expect(both.draft.pendingName).toBeUndefined();
    expect(both.reply).toContain("Shall I send");
    for (const [text, yes] of [
      ["yes please", true],
      ["ok please", true],
      ["haan ji", true],
      ["no thanks", false],
      ["nahi ji", false],
    ] as const) {
      const answered = counsel({ text, language: "en", draft: pending.draft, now });
      expect(answered.ready, text).toBe(false);
      expect(answered.draft.name, text).toBe(yes ? "Aman Gill" : "Simran");
      expect(answered.draft.pendingName, text).toBeUndefined();
    }

    const phone = counsel({ text: "change phone to 9876501234", language: "en", draft: midway, now });
    expect(phone.draft.phone).toBe("9876501234");
    expect(phone.reply).toContain("Which date works?");
    expect(phone.reply).not.toMatch(/sample|असली|ਅਸਲੀ/i);
    const wrong = counsel({ text: "wrong", language: "en", draft: midway, now });
    expect(wrong.draft.name).toBe("Simran");
    expect(wrong.reply).toContain("Which part is wrong?");
    expect(wrong.reply).not.toMatch(/couldn.t read that date/);
    expect(counsel({ text: "ਸਭ ਸਹੀ ਹੈ", language: "pa", draft: confirming, now }).ready).toBe(true);
    const started = counsel({ text: "Book an IELTS trial", language: "en", now }).draft;
    for (const text of ["one minute", "wait", "ek minute", "ruko"]) {
      expect(counsel({ text, language: "en", draft: started, now }).draft.name, text).toBeUndefined();
    }
  });
});
