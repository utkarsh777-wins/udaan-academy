import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

import { createSessionToken, verifySessionToken } from "@/lib/admin-session";
import { POST as postBooking } from "@/app/api/bookings/route";
import { POST as postSession } from "@/app/api/bookings/session/route";
import { POST as postChat } from "@/app/api/chat/route";
import {
  allowAttempt,
  clientIp,
  handleBookingRequest,
  listBookings,
  resetMemoryAttemptsForTests,
  submitBooking,
  warnIfUntrustedProxy,
} from "@/lib/bookings";
import { askCounsellor } from "@/lib/chat/llm";

let directory: string;
const now = new Date("2026-11-02T04:30:00.000Z");

function payload(phone: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Aman Gill",
    phone,
    course: "ielts-pte",
    batch: "morning",
    date: "2026-11-20",
    ...overrides,
  };
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "udaan-bookings-"));
  process.env.BOOKINGS_STORE_PATH = path.join(directory, "bookings.json");
  delete process.env.BOOKING_WEBHOOK_URL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.VERCEL;
  delete process.env.TRUST_PROXY;
  delete process.env.TRUSTED_PROXY_HOPS;
  delete process.env.BOOKINGS_VIEW_SECRET;
  resetMemoryAttemptsForTests();
});

afterEach(async () => {
  delete process.env.BOOKINGS_STORE_PATH;
  await rm(directory, { recursive: true, force: true });
});

describe("POST /api/bookings", () => {
  it("stores a valid trial class and allows a missing email", async () => {
    const response = await handleBookingRequest(jsonRequest(payload("9876543210")), { now, webhookUrl: null });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { booking: { id: string; email: null; phone: string } };
    expect(body.booking.id).toMatch(/^UA-/);
    expect(body.booking.email).toBeNull();
    expect(body.booking.phone).toBe("9876543210");
    const stored = await listBookings();
    expect(stored).toHaveLength(1);
  });

  it("stores an optional preferred language and rejects a bad one", async () => {
    const saved = await submitBooking(payload("9876543222", { language: "pa" }), { ip: "10.0.0.9", now, webhookUrl: null });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.booking.language).toBe("pa");
    const bad = await submitBooking(payload("9876543223", { language: "fr" }), { ip: "10.0.0.10", now, webhookUrl: null });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fields).toContain("language");
  });

  it("accepts one-word time names and rejects junk names", async () => {
    const names = ["Sham", "Subah", "Savera", "Sandhya", "शाम", "ਸ਼ਾਮ"];
    const languages = ["en", "hi", "pa"] as const;
    let phone = 9876610000;
    for (const name of names) {
      for (const language of languages) {
        phone += 1;
        const saved = await submitBooking(payload(String(phone), { name, language, source: "form" }), {
          ip: `10.4.${phone % 200}.${(phone >> 8) % 200}`,
          now,
          webhookUrl: null,
        });
        expect(saved.ok, `${language} ${name}`).toBe(true);
        if (saved.ok) {
          expect(saved.booking.name).toBe(name);
          expect(saved.booking.language).toBe(language);
          expect(saved.booking.source).toBe("form");
        }
      }
    }
    for (const name of ["Nanak", "Ona"]) {
      phone += 1;
      const kept = await submitBooking(payload(String(phone), { name }), {
        ip: `10.8.${phone % 200}.1`,
        now,
        webhookUrl: null,
      });
      expect(kept.ok, name).toBe(true);
    }
    for (const name of ["hmm", "test", "booking", "later", "skip", "na", "none", "online", "Punjabi", "interested"]) {
      const rejected = await submitBooking(payload("9876610999", { name }), { ip: "10.4.0.2", now, webhookUrl: null });
      expect(rejected.ok, name).toBe(false);
      if (!rejected.ok) expect(rejected.fields, name).toContain("name");
    }
  });

  it("rejects a missing name, a bad phone, a bad course, and a bad email", async () => {
    const missing = await submitBooking(payload("9876543211", { name: "" }), { ip: "10.0.0.1", now, webhookUrl: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(422);

    const phone = await submitBooking(payload("12345"), { ip: "10.0.0.2", now, webhookUrl: null });
    expect(phone.ok).toBe(false);
    if (!phone.ok) expect(phone.fields).toContain("phone");

    const course = await submitBooking(payload("9876543212", { course: "guitar" }), {
      ip: "10.0.0.3",
      now,
      webhookUrl: null,
    });
    expect(course.ok).toBe(false);

    const email = await submitBooking(payload("9876543213", { email: "not-an-email" }), {
      ip: "10.0.0.4",
      now,
      webhookUrl: null,
    });
    expect(email.ok).toBe(false);
    if (!email.ok) expect(email.message.toLowerCase()).not.toContain("we have emailed");
  });

  it("allows three attempts per IP in ten minutes and blocks the fourth", async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await submitBooking(payload(`987650000${index}`), { ip: "10.1.0.8", now, webhookUrl: null });
      expect(result.ok).toBe(true);
    }
    const blocked = await submitBooking(payload("9876500009"), { ip: "10.1.0.8", now, webhookUrl: null });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(429);

    const later = new Date(now.getTime() + 11 * 60 * 1000);
    const again = await submitBooking(payload("9876500010"), { ip: "10.1.0.8", now: later, webhookUrl: null });
    expect(again.ok).toBe(true);
  });

  it("allows one trial per phone per day", async () => {
    const first = await submitBooking(payload("9811111111"), { ip: "10.2.0.1", now, webhookUrl: null });
    expect(first.ok).toBe(true);
    const second = await submitBooking(payload("9811111111"), { ip: "10.2.0.2", now, webhookUrl: null });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);

    const tomorrow = new Date("2026-11-03T04:30:00.000Z");
    const nextDay = await submitBooking(payload("9811111111"), { ip: "10.2.0.3", now: tomorrow, webhookUrl: null });
    expect(nextDay.ok).toBe(true);
  });

  it("posts to the webhook and still stores the request if the webhook fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const saved = await submitBooking(payload("9822222222"), {
      ip: "10.3.0.1",
      now,
      webhookUrl: "https://hooks.example.test/trial",
    });
    expect(saved.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(init.body)).toContain("trial_class_request");

    fetchMock.mockRejectedValue(new Error("down"));
    const stillSaved = await submitBooking(payload("9822222223"), {
      ip: "10.3.0.2",
      now,
      webhookUrl: "https://hooks.example.test/trial",
    });
    expect(stillSaved.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it("B7 rejects a trial date that is not one of the batch days", async () => {
    const sunday = await submitBooking(payload("9876543298", { date: "2026-11-08" }), {
      ip: "10.7.0.1",
      now,
      webhookUrl: null,
    });
    expect(sunday.ok).toBe(false);
    if (!sunday.ok) {
      expect(sunday.status).toBe(422);
      expect(sunday.fields).toContain("date");
      expect(sunday.message).toMatch(/doesn't run/);
      expect(sunday.message).toMatch(/next open day/i);
    }
    const several = await submitBooking(payload("12345", { name: "", date: "2026-11-08" }), {
      ip: "10.7.0.2",
      now,
      webhookUrl: null,
    });
    expect(several.ok).toBe(false);
    if (!several.ok) {
      expect(several.message).toMatch(/Add the name/);
      expect(several.message).toMatch(/10-digit/);
      expect(several.message).toMatch(/doesn't run/);
    }
  });

  it("B8 ignores a spoofed forwarding header and also limits one phone", async () => {
    process.env.VERCEL = "1";
    try {
      for (let index = 0; index < 3; index += 1) {
        const response = await handleBookingRequest(
          jsonRequest(payload(`987670000${index}`), `198.51.100.${index}`, {
            "x-vercel-forwarded-for": "203.0.113.9",
            "x-real-ip": `198.51.100.${index}`,
          }),
          { now, webhookUrl: null },
        );
        expect(response.status).toBe(201);
      }
      const blocked = await handleBookingRequest(
        jsonRequest(payload("9876700009"), "198.51.100.50", {
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-real-ip": "198.51.100.50",
        }),
        { now, webhookUrl: null },
      );
      expect(blocked.status).toBe(429);
    } finally {
      delete process.env.VERCEL;
    }

    const first = await submitBooking(payload("9876800001"), { ip: "10.8.1.1", now, webhookUrl: null });
    expect(first.ok).toBe(true);
    await submitBooking(payload("9876800001"), { ip: "10.8.1.2", now, webhookUrl: null });
    await submitBooking(payload("9876800001"), { ip: "10.8.1.3", now, webhookUrl: null });
    const phoneBlocked = await submitBooking(payload("9876800001"), { ip: "10.8.1.4", now, webhookUrl: null });
    expect(phoneBlocked.ok).toBe(false);
    if (!phoneBlocked.ok) expect(phoneBlocked.status).toBe(429);
  });

  it("B8 rejects a non-JSON body and a cross-site post", async () => {
    const plain = await handleBookingRequest(
      new Request("http://127.0.0.1:43123/api/bookings", {
        method: "POST",
        headers: { "content-type": "text/plain", origin: "https://evil.example" },
        body: JSON.stringify(payload("9876543201")),
      }),
      { now, webhookUrl: null },
    );
    expect(plain.status).toBe(415);

    const crossSite = await handleBookingRequest(
      new Request("http://127.0.0.1:43123/api/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "127.0.0.1:43123",
          origin: "https://evil.example",
        },
        body: JSON.stringify(payload("9876543202")),
      }),
      { now, webhookUrl: null },
    );
    expect(crossSite.status).toBe(403);

    const empty = await submitBooking({}, { ip: "10.6.0.1", now, webhookUrl: null });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toMatch(/^Add the name/);
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await handleBookingRequest(
      new Request("http://localhost/api/bookings", {
        method: "POST",
        headers: { "x-forwarded-for": "10.4.0.1", "content-type": "application/json" },
        body: "{",
      }),
      { now, webhookUrl: null },
    );
    expect(response.status).toBe(400);
  });
});

describe("R3-B1 unknown client address", () => {
  it("does not share the 3-booking cap across visitors", async () => {
    const phones = ["9810000001", "9810000002", "9810000003", "9810000004"];
    for (const phone of phones) {
      const response = await handleBookingRequest(
        jsonRequest(payload(phone), `198.51.100.${phone.slice(-1)}`),
        { now, webhookUrl: null },
      );
      expect(response.status).toBe(201);
    }
    expect(clientIp(jsonRequest(payload("9810000005")))).toBeNull();
  });

  it("keeps the per-phone cap when the address is unknown", async () => {
    const first = await submitBooking(payload("9810000099"), { ip: null, now, webhookUrl: null });
    expect(first.ok).toBe(true);
    const second = await submitBooking(payload("9810000099"), { ip: null, now, webhookUrl: null });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);
    await submitBooking(payload("9810000099"), { ip: null, now, webhookUrl: null });
    const blocked = await submitBooking(payload("9810000099"), { ip: null, now, webhookUrl: null });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.limit).toBe("phone");
    }
  });

  it("R4-B1 lets a valid booking through after 200 junk posts", async () => {
    for (let index = 0; index < 200; index += 1) {
      const result = await submitBooking({ x: 1 }, { ip: null, now, webhookUrl: null });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(422);
    }
    await expect(readFile(process.env.BOOKINGS_STORE_PATH ?? "", "utf8")).rejects.toThrow();
    const saved = await submitBooking(payload("9810000088"), { ip: null, now, webhookUrl: null });
    expect(saved.ok).toBe(true);

    for (let index = 0; index < 8; index += 1) {
      await submitBooking({ x: 1 }, { ip: "203.0.113.40", now, webhookUrl: null });
    }
    const afterJunk = await submitBooking(payload("9810000087"), { ip: "203.0.113.40", now, webhookUrl: null });
    expect(afterJunk.ok).toBe(true);
  });

  it("R7 keeps a real date error after the junk cap is full", async () => {
    for (let index = 0; index < 3; index += 1) {
      const junk = await submitBooking({ x: 1 }, { ip: "203.0.113.77", now, webhookUrl: null });
      expect(junk.ok).toBe(false);
      if (!junk.ok) expect(junk.status).toBe(422);
    }
    const blocked = await submitBooking({ x: 1 }, { ip: "203.0.113.77", now, webhookUrl: null });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.message).toMatch(/Too many attempts/);
    }
    const weekday = await submitBooking(payload("9810000044", { date: "2026-11-08" }), {
      ip: "203.0.113.77",
      now,
      webhookUrl: null,
    });
    expect(weekday.ok).toBe(false);
    if (!weekday.ok) {
      expect(weekday.status).toBe(422);
      expect(weekday.dateReason).toBe("weekday");
      expect(weekday.message).toMatch(/doesn't run/);
    }
    const stillJunk = await submitBooking({ x: 2 }, { ip: "203.0.113.77", now, webhookUrl: null });
    expect(stillJunk.ok).toBe(false);
    if (!stillJunk.ok) expect(stillJunk.status).toBe(429);
  });

  it("still stops the site after 200 saved trials in an hour", async () => {
    for (let index = 0; index < 200; index += 1) {
      const result = await submitBooking(payload(`9${String(index).padStart(9, "0")}`), {
        ip: null,
        now,
        webhookUrl: null,
      });
      expect(result.ok).toBe(true);
    }
    const blocked = await submitBooking(payload("9810000086"), { ip: null, now, webhookUrl: null });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.limit).toBe("site");
    }
  });

  it("reads x-real-ip only when proxy hops are unset, and ignores it when hops are set", () => {
    process.env.TRUST_PROXY = "1";
    const overwritten = new Request("http://127.0.0.1/api/bookings", {
      headers: { "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.8, 203.0.113.10" },
    });
    expect(clientIp(overwritten)).toBe("203.0.113.10");

    process.env.TRUSTED_PROXY_HOPS = "1";
    const forwarded = new Request("http://127.0.0.1/api/bookings", {
      headers: { "x-real-ip": "198.51.100.8", "x-forwarded-for": "198.51.100.8, 203.0.113.10" },
    });
    expect(clientIp(forwarded)).toBe("203.0.113.10");

    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(clientIp(forwarded)).toBeNull();
  });

  it("uses site ceilings for chat and login when the address is unknown", async () => {
    for (let index = 0; index < 20; index += 1) {
      expect((await allowAttempt({ ip: null, kind: "chat", limit: 20, now })).ok).toBe(true);
    }
    expect((await allowAttempt({ ip: null, kind: "chat", limit: 20, now })).ok).toBe(true);
    resetMemoryAttemptsForTests();

    for (let index = 0; index < 2000; index += 1) {
      expect((await allowAttempt({ ip: null, kind: "chat", limit: 20, now })).ok).toBe(true);
    }
    const chatBlocked = await allowAttempt({ ip: null, kind: "chat", limit: 20, now });
    expect(chatBlocked.ok).toBe(false);
    if (!chatBlocked.ok) expect(chatBlocked.limit).toBe("site");
    resetMemoryAttemptsForTests();

    for (let index = 0; index < 5; index += 1) {
      expect((await allowAttempt({ ip: "203.0.113.4", kind: "login", limit: 5, now })).ok).toBe(true);
    }
    const loginBlocked = await allowAttempt({ ip: "203.0.113.4", kind: "login", limit: 5, now });
    expect(loginBlocked.ok).toBe(false);
    if (!loginBlocked.ok) expect(loginBlocked.limit).toBe("ip");
    expect((await allowAttempt({ ip: "203.0.113.5", kind: "login", limit: 5, now })).ok).toBe(true);
    resetMemoryAttemptsForTests();

    for (let index = 0; index < 50; index += 1) {
      expect((await allowAttempt({ ip: null, kind: "login", limit: 5, now })).ok).toBe(true);
    }
    const siteLogin = await allowAttempt({ ip: null, kind: "login", limit: 5, now });
    expect(siteLogin.ok).toBe(false);
    if (!siteLogin.ok) expect(siteLogin.limit).toBe("site");
  });

  it("logs one startup warning when production has no proxy trust", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUST_PROXY", "1");
    warnIfUntrustedProxy();
    expect(spy).not.toHaveBeenCalled();
    vi.stubEnv("TRUST_PROXY", "");
    delete process.env.TRUST_PROXY;
    warnIfUntrustedProxy();
    expect(spy).toHaveBeenCalledOnce();
    warnIfUntrustedProxy();
    expect(spy).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
    spy.mockRestore();
  });

  it("rejects a same-day trial after the batch has ended", async () => {
    const morning = await submitBooking(
      payload("9810000071", { course: "jee-foundation", batch: "morning", date: "2026-11-02" }),
      { ip: "10.12.0.1", now, webhookUrl: null },
    );
    expect(morning.ok).toBe(false);
    if (!morning.ok) {
      expect(morning.status).toBe(422);
      expect(morning.dateReason).toBe("ended");
    }
    const evening = await submitBooking(
      payload("9810000072", { course: "jee-foundation", batch: "evening", date: "2026-11-02" }),
      { ip: "10.12.0.2", now, webhookUrl: null },
    );
    expect(evening.ok).toBe(true);
  });
});

describe("admin session cookie", () => {
  it("accepts a signed token until it expires and rejects a bad signature", () => {
    const issued = Date.parse("2026-11-02T00:00:00.000Z");
    const token = createSessionToken("sample-secret", issued);
    expect(verifySessionToken(token, "sample-secret", issued + 1000)).toBe(true);
    expect(verifySessionToken(token, "sample-secret", issued + 8 * 60 * 60 * 1000)).toBe(false);
    expect(verifySessionToken(token, "other-secret", issued + 1000)).toBe(false);
    expect(verifySessionToken(`${token}x`, "sample-secret", issued + 1000)).toBe(false);
  });
});

describe("LLM fallback", () => {
  it("stays on the rule-based counsellor when no key is set", async () => {
    expect(await askCounsellor({ language: "en", history: [], message: "fees" })).toBeNull();
  });
});

describe("route handlers", () => {
  it("POST /api/bookings rejects a disguised content type and a cross-site origin", async () => {
    const disguised = await postBooking(
      new Request("http://127.0.0.1:43123/api/bookings", {
        method: "POST",
        headers: { "content-type": "text/plain; charset=application/json", host: "127.0.0.1:43123" },
        body: JSON.stringify(payload("9876543288")),
      }),
    );
    expect(disguised.status).toBe(415);

    const foreign = await postBooking(
      new Request("http://127.0.0.1:43123/api/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "127.0.0.1:43123",
          origin: "https://evil.example",
        },
        body: JSON.stringify(payload("9876543289")),
      }),
    );
    expect(foreign.status).toBe(403);
  });

  it("R4-B1 accepts the right secret after 50 wrong guesses", async () => {
    process.env.BOOKINGS_VIEW_SECRET = "owner-secret";
    for (let index = 0; index < 50; index += 1) {
      const response = await postSession(sessionRequest("wrong-guess"));
      expect(response.status).toBe(401);
    }
    const opened = await postSession(sessionRequest("owner-secret"));
    expect(opened.status).toBe(200);
    const stillWrong = await postSession(sessionRequest("another-guess"));
    expect(stillWrong.status).toBe(429);
    const openedAgain = await postSession(sessionRequest("owner-secret"));
    expect(openedAgain.status).toBe(200);
  });

  it("POST /api/chat answers an admission question and does not save a booking", async () => {
    const response = await postChat(
      new Request("http://127.0.0.1:43123/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
        body: JSON.stringify({ message: "how to join", language: "en", draft: {}, history: [] }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { reply: string; booking: unknown };
    expect(body.booking).toBeNull();
    expect(body.reply.toLowerCase()).toContain("trial");
    expect(body.reply.toLowerCase()).toContain("fee");
  });

  it("records the chat language on a saved trial", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      const response = await postChat(
        new Request("http://127.0.0.1:43123/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
          body: JSON.stringify({
            message: "yes",
            language: "pa",
            draft: {
              active: true,
              confirming: true,
              name: "Simran",
              phone: "9876511111",
              course: "ielts-pte",
              batch: "morning",
              date: "2026-11-20",
            },
            history: [],
          }),
        }),
      );
      expect(response.status).toBe(200);
      const saved = await listBookings();
      expect(saved[0]?.language).toBe("pa");
      expect(saved[0]?.source).toBe("chat");
    } finally {
      vi.useRealTimers();
    }
  });

  it("localises a chat rate limit and keeps the draft", async () => {
    for (let index = 0; index < 2000; index += 1) {
      expect((await allowAttempt({ ip: null, kind: "chat", limit: 20 })).ok).toBe(true);
    }
    const response = await postChat(
      new Request("http://127.0.0.1:43123/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
        body: JSON.stringify({
          message: "फीस",
          language: "hi",
          draft: { active: true, name: "अमन" },
          history: [],
        }),
      }),
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as { reply: string; draft: { name?: string }; limit?: string };
    expect(body.limit).toBe("site");
    expect(body.reply).toContain("साइट");
    expect(body.draft.name).toBe("अमन");

    resetMemoryAttemptsForTests();
    process.env.VERCEL = "1";
    for (let index = 0; index < 20; index += 1) {
      expect((await allowAttempt({ ip: "203.0.113.77", kind: "chat", limit: 20 })).ok).toBe(true);
    }
    const perIp = await postChat(
      new Request("http://127.0.0.1:43123/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "127.0.0.1:43123",
          "x-vercel-forwarded-for": "203.0.113.77",
        },
        body: JSON.stringify({
          message: "ਫੀਸ",
          language: "pa",
          draft: { active: true, name: "ਅਮਨ" },
          history: [],
        }),
      }),
    );
    expect(perIp.status).toBe(429);
    const punjabi = (await perIp.json()) as { reply: string; draft: { name?: string }; limit?: string };
    expect(punjabi.limit).toBe("ip");
    expect(punjabi.reply).toContain("ਕਨੈਕਸ਼ਨ");
    expect(punjabi.draft.name).toBe("ਅਮਨ");
    delete process.env.VERCEL;
  });

  it("POST /api/bookings keeps a far date off the saved list", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      const response = await postBooking(
        new Request("http://127.0.0.1:43123/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
          body: JSON.stringify(payload("9876543277", { date: "2027-10-15" })),
        }),
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as { dateReason?: string; message: string };
      expect(body.dateReason).toBe("window");
      expect(body.message).toMatch(/45 days/);
    } finally {
      vi.useRealTimers();
    }
  });
});

function sessionRequest(secret: string) {
  return new Request("http://127.0.0.1:43123/api/bookings/session", {
    method: "POST",
    headers: { "content-type": "application/json", host: "127.0.0.1:43123" },
    body: JSON.stringify({ secret }),
  });
}

function jsonRequest(body: unknown, ip = "10.9.0.1", extra: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:43123/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, host: "127.0.0.1:43123", ...extra },
    body: JSON.stringify(body),
  });
}
