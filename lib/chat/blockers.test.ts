import { describe, expect, it } from "vitest";
import { getCourse } from "@/lib/academy";
import { counsel } from "@/lib/chat/respond";
import { parseUtterance } from "@/lib/chat/parser";

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
});
