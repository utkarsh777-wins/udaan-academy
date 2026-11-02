import { describe, expect, it } from "vitest";
import { counsel, openingGreeting } from "@/lib/chat/respond";
import { parseUtterance, tokenize } from "@/lib/chat/parser";

const sham = "\u0A38\u0A3C\u0A3E\u0A2E";

describe("tokenizer", () => {
  it("keeps Devanagari combining marks on the base letter", () => {
    expect(tokenize("शाम के 5 बजे")).toEqual(["शाम", "के", "5", "बजे"]);
    expect(tokenize("शाम")[0]).toMatch(/\p{M}/u);
  });

  it("keeps a Gurmukhi nukta inside the word", () => {
    const [token] = tokenize(sham);
    expect(token?.normalize("NFC")).toBe(sham.normalize("NFC"));
    expect(token).toMatch(/\p{M}/u);
  });
});

describe("course matching", () => {
  it("sends Canada to IELTS in English", () => {
    const result = parseUtterance("I want to go to Canada");
    expect(result.courses).toEqual(["ielts-pte"]);
    expect(result.intent).toBe("recommend");
  });

  it("sends class 11 medical to NEET only", () => {
    const result = parseUtterance("class 11 medical");
    expect(result.courses).toEqual(["neet-foundation"]);
    expect(result.intent).toBe("recommend");
  });

  it("matches Canada and NEET in Hindi", () => {
    expect(parseUtterance("मुझे कनाडा जाना है").courses).toEqual(["ielts-pte"]);
    expect(parseUtterance("क्लास 11 मेडिकल").courses).toEqual(["neet-foundation"]);
  });

  it("matches Canada and NEET in Punjabi", () => {
    expect(parseUtterance("ਮੈਨੂੰ ਕੈਨੇਡਾ ਜਾਣਾ ਹੈ").courses).toEqual(["ielts-pte"]);
    expect(parseUtterance("ਨੀਟ ਦੀ ਤਿਆਰੀ").courses).toContain("neet-foundation");
  });

  it("matches engineering, spoken English, and the Punjab board", () => {
    expect(parseUtterance("engineering entrance").courses).toEqual(["jee-foundation"]);
    expect(parseUtterance("I need spoken English").courses).toEqual(["spoken-english"]);
    expect(parseUtterance("Punjab board class 10").courses).toEqual(["punjab-board"]);
  });
});

describe("batch and time parsing", () => {
  it("reads Hindi time-of-day words", () => {
    expect(parseUtterance("सुबह का बैच कब है")).toMatchObject({
      intent: "batches",
      batch: "morning",
      period: "morning",
    });
    expect(parseUtterance("शाम का बैच")).toMatchObject({ batch: "evening", period: "evening" });
    expect(parseUtterance("रात को क्लास है क्या")).toMatchObject({ period: "night", batch: "evening" });
  });

  it("reads Punjabi time-of-day words, including a nukta in ਸ਼ਾਮ", () => {
    expect(parseUtterance("ਸਵੇਰੇ ਦਾ ਬੈਚ")).toMatchObject({ batch: "morning", period: "morning" });
    expect(parseUtterance(`${sham} ਦਾ ਬੈਚ`)).toMatchObject({ batch: "evening", period: "evening" });
    expect(parseUtterance("ਰਾਤ ਨੂੰ")).toMatchObject({ period: "night", batch: "evening" });
  });

  it("parses 5 बजे as a clock time", () => {
    const result = parseUtterance("सुबह 5 बजे");
    expect(result.time).toEqual({ hour: 5, minute: 0 });
    expect(result.partySize).toBeNull();
    expect(result.batch).toBe("morning");
  });
});

describe("party size is not a time", () => {
  it("treats a number before लोग as a count", () => {
    const result = parseUtterance("हम 5 लोग हैं");
    expect(result.partySize).toBe(5);
    expect(result.time).toBeNull();
    expect(result.intent).toBe("party");
  });

  it("treats a number before ਲੋਕ as a count", () => {
    const result = parseUtterance("ਅਸੀਂ 5 ਲੋਕ ਹਾਂ");
    expect(result.partySize).toBe(5);
    expect(result.time).toBeNull();
  });

  it("treats a number before people as a count", () => {
    const result = parseUtterance("we are 5 people");
    expect(result.partySize).toBe(5);
    expect(result.time).toBeNull();
  });
});

describe("greetings, fees, phone, and off-topic", () => {
  it("recognises greetings in English, Hindi, and Punjabi", () => {
    expect(parseUtterance("hello").intent).toBe("greeting");
    expect(parseUtterance("नमस्ते").intent).toBe("greeting");
    expect(parseUtterance("ਸਤ ਸ੍ਰੀ ਅਕਾਲ").intent).toBe("greeting");
  });

  it("recognises a fees question in each language", () => {
    expect(parseUtterance("what is the fee").intent).toBe("fees");
    expect(parseUtterance("फीस कितनी है").intent).toBe("fees");
    expect(parseUtterance("फ़ीस कितनी है").intent).toBe("fees");
    expect(parseUtterance("ਫੀਸ ਕਿੰਨੀ ਹੈ").intent).toBe("fees");
  });

  it("recognises a phone question in each language", () => {
    expect(parseUtterance("what is your phone number").intent).toBe("phone");
    expect(parseUtterance("फोन नंबर क्या है").intent).toBe("phone");
    expect(parseUtterance("ਫੋਨ ਨੰਬਰ ਕੀ ਹੈ").intent).toBe("phone");
  });

  it("still accepts फीस, फोन and फ्री without a nukta", () => {
    expect(parseUtterance("फीस कितनी है").intent).toBe("fees");
    expect(parseUtterance("फोन नंबर क्या है").intent).toBe("phone");
    expect(parseUtterance("फ्री क्लास बुक करो").intent).toBe("book");
  });

  it("recognises an off-topic question in each language", () => {
    expect(parseUtterance("What's the weather today?").intent).toBe("off_topic");
    expect(parseUtterance("आज मौसम कैसा है").intent).toBe("off_topic");
    expect(parseUtterance("ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ").intent).toBe("off_topic");
  });
});

describe("counsellor replies", () => {
  it("greets in the selected language", () => {
    expect(openingGreeting("hi").startsWith("नमस्ते।")).toBe(true);
    expect(openingGreeting("pa").startsWith("ਸਤ ਸ੍ਰੀ ਅਕਾਲ।")).toBe(true);
    expect(openingGreeting("en").startsWith("Hello.")).toBe(true);
  });

  it("recommends IELTS in Hindi with a danda and no English full stop", () => {
    const reply = counsel({ text: "मुझे कनाडा जाना है", language: "hi" }).reply;
    expect(reply).toContain("IELTS");
    expect(reply).toContain("बैच");
    expect(reply).toContain("।");
    expect(reply).not.toMatch(/\.\s/);
  });

  it("answers fees in Punjabi and a phone question with the sample number", () => {
    const fees = counsel({ text: "ਫੀਸ ਕਿੰਨੀ ਹੈ", language: "pa" }).reply;
    expect(fees).toContain("ਫੀਸ");
    expect(fees).toContain("।");
    expect(fees).toMatch(/₹/);
    const phone = counsel({ text: "what is your phone number", language: "en" }).reply;
    expect(phone).toContain("+91 98XXX XXXXX (sample)");
  });

  it("refuses an off-topic question without inventing a forecast", () => {
    const reply = counsel({ text: "What's the weather today?", language: "en" }).reply;
    expect(reply.toLowerCase()).not.toContain("sunny");
    expect(reply.toLowerCase()).not.toContain("degrees");
    expect(reply).toContain("course");
  });

  it("collects a trial class without confirming it itself", () => {
    let draft = {};
    draft = counsel({ text: "Book a free trial class", language: "en", draft }).draft;
    draft = counsel({ text: "Aman Gill", language: "en", draft }).draft;
    draft = counsel({ text: "9876543210", language: "en", draft }).draft;
    draft = counsel({ text: "IELTS", language: "en", draft }).draft;
    draft = counsel({ text: "morning", language: "en", draft }).draft;
    const summary = counsel({ text: "20 November 2026", language: "en", draft, now: new Date("2026-11-01T04:00:00.000Z") });
    expect(summary.ready).toBe(false);
    expect(summary.draft.confirming).toBe(true);
    expect(summary.reply.toLowerCase()).toContain("yes");
    const ready = counsel({
      text: "yes",
      language: "en",
      draft: summary.draft,
      now: new Date("2026-11-01T04:00:00.000Z"),
    });
    expect(ready.ready).toBe(true);
    expect(ready.reply.toLowerCase()).not.toContain("you're booked");
    expect(ready.reply.toLowerCase()).not.toContain("booking is confirmed");
  });
});
