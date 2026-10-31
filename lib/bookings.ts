import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { academy, getCourse, type BatchId } from "@/lib/academy";
import { addISODays, formatLongDate, isISODate, todayISO } from "@/lib/dates";
import { isPersonName } from "@/lib/chat/parser";
import { batchHasEnded, nextOpenDate, weekdayIndex } from "@/lib/schedule";

export type Booking = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  language?: "en" | "hi" | "pa";
  course: string;
  batch: BatchId;
  date: string;
  createdAt: string;
  source: "form" | "chat";
};

export type BookingErrorCode = "bad_json" | "invalid" | "rate_limit" | "duplicate_phone";

export type SubmitResult =
  | { ok: true; status: 201; booking: Booking }
  | {
      ok: false;
      status: 400 | 422 | 409 | 429;
      error: BookingErrorCode;
      message: string;
      fields?: string[];
      limit?: "phone" | "ip" | "site";
      dateReason?: "window" | "weekday" | "ended";
    };

type Attempt = {
  ip: string;
  at: number;
  phone?: string;
  kind?: "booking" | "chat" | "login";
};

type Store = {
  bookings: Booking[];
  attempts: Attempt[];
};

const WINDOW_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const SITE_BOOKING_LIMIT = 200;
const SITE_CHAT_LIMIT = 2000;
const SITE_LOGIN_LIMIT = 50;
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

let cachedPath: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function resolvePath(): Promise<string> {
  const override = process.env.BOOKINGS_STORE_PATH?.trim();
  if (override) return override;
  if (cachedPath) return cachedPath;
  const preferred = path.join(process.cwd(), "data", "bookings.json");
  try {
    await mkdir(path.dirname(preferred), { recursive: true });
    await writeFile(preferred, "", { flag: "a" });
    cachedPath = preferred;
  } catch {
    cachedPath = path.join("/tmp", "udaan-academy-bookings.json");
  }
  return cachedPath;
}

async function readStore(file: string): Promise<Store> {
  try {
    const raw = await readFile(file, "utf8");
    if (!raw.trim()) return { bookings: [], attempts: [] };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    };
  } catch {
    return { bookings: [], attempts: [] };
  }
}

async function writeStore(file: string, store: Store): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, file);
}

export function normalizePhone(value: string): string | null {
  const folded = [...value].map((char) => DIGITS[char] ?? char).join("");
  const digits = folded.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

function dayKey(isoDateTime: Date): string {
  return todayISO(isoDateTime);
}

export function clientIp(request: Request): string | null {
  if (process.env.VERCEL === "1") {
    return (
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null
    );
  }
  if (process.env.TRUST_PROXY === "1") {
    const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? "0");
    if (!Number.isFinite(hops) || hops <= 0) {
      return request.headers.get("x-real-ip")?.trim() || null;
    }
    const parts = (request.headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const index = parts.length - hops;
    return index >= 0 ? parts[index] || null : null;
  }
  return null;
}

export async function listBookings(): Promise<Booking[]> {
  return locked(async () => {
    const file = await resolvePath();
    const store = await readStore(file);
    return [...store.bookings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });
}

export async function submitBooking(
  input: unknown,
  options: {
    ip: string | null;
    now?: Date;
    webhookUrl?: string | null;
    source?: "form" | "chat";
  },
): Promise<SubmitResult> {
  const now = options.now ?? new Date();
  return locked(() => writeBooking(input, { ...options, now }));
}

async function writeBooking(
  input: unknown,
  options: { ip: string | null; now: Date; webhookUrl?: string | null; source?: "form" | "chat" },
): Promise<SubmitResult> {
  const nowMs = options.now.getTime();
  const parsed = input === undefined ? badJson() : validate(input, options.now, options.source);
  if (!parsed.ok) {
    if (!chargeJunk(options.ip, nowMs)) return connectionRateLimit();
    return parsed;
  }

  const file = await resolvePath();
  const store = await readStore(file);
  store.attempts = store.attempts.filter((attempt) => nowMs - attempt.at < 24 * 60 * 60 * 1000);

  const phoneGuess = parsed.booking.phone;
  const recentBooking = store.attempts.filter(
    (attempt) => (!attempt.kind || attempt.kind === "booking") && nowMs - attempt.at < WINDOW_MS,
  );
  const recentIp =
    options.ip == null ? [] : recentBooking.filter((attempt) => attempt.ip === options.ip);
  const recentPhone = recentBooking.filter((attempt) => attempt.phone === phoneGuess);
  const savedThisHour = store.bookings.filter((booking) => {
    const at = Date.parse(booking.createdAt);
    return Number.isFinite(at) && nowMs - at < HOUR_MS;
  }).length;
  const phoneLimited = recentPhone.length >= MAX_ATTEMPTS;
  const ipLimited = options.ip != null && recentIp.length >= MAX_ATTEMPTS;
  const siteLimited = savedThisHour >= SITE_BOOKING_LIMIT;
  if (phoneLimited || ipLimited || siteLimited) {
    await writeStore(file, store);
    const limit = phoneLimited ? "phone" : ipLimited ? "ip" : "site";
    return {
      ok: false,
      status: 429,
      error: "rate_limit",
      limit,
      message:
        limit === "phone"
          ? "Too many attempts for this number. Wait ten minutes and try again."
          : limit === "site"
            ? "Too many trial requests this hour. Try again later."
            : "Too many attempts from this connection. Wait ten minutes and try again.",
    };
  }
  store.attempts.push({ ip: options.ip ?? "", at: nowMs, phone: phoneGuess, kind: "booking" });

  const today = dayKey(options.now);
  const duplicate = store.bookings.some(
    (booking) => booking.phone === parsed.booking.phone && dayKey(new Date(booking.createdAt)) === today,
  );
  if (duplicate) {
    await writeStore(file, store);
    return {
      ok: false,
      status: 409,
      error: "duplicate_phone",
      message: "This phone number already has a free trial class request today.",
    };
  }

  const booking: Booking = {
    ...parsed.booking,
    id: nextId(store.bookings),
    createdAt: options.now.toISOString(),
  };
  store.bookings.push(booking);
  await writeStore(file, store);

  const webhook =
    options.webhookUrl === undefined ? process.env.BOOKING_WEBHOOK_URL?.trim() || null : options.webhookUrl;
  if (webhook) await notifyWebhook(webhook, booking);
  return { ok: true, status: 201, booking };
}

function validate(
  input: unknown,
  now: Date,
  source: "form" | "chat" | undefined,
): { ok: true; booking: Omit<Booking, "id" | "createdAt"> } | Extract<SubmitResult, { ok: false }> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      status: 422,
      error: "invalid",
      message: "Send a name, phone, course, batch, and date.",
      fields: ["name", "phone", "course", "batch", "date"],
    };
  }
  const body = input as Record<string, unknown>;
  const fields: string[] = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isPersonName(name)) fields.push("name");
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) fields.push("phone");
  const courseSlug = typeof body.course === "string" ? body.course : "";
  const course = getCourse(courseSlug);
  if (!course) fields.push("course");
  const batch = body.batch;
  const batchOk =
    (batch === "morning" || batch === "evening" || batch === "weekend") &&
    Boolean(course?.batches.some((item) => item.id === batch));
  if (!batchOk) fields.push("batch");
  const date = typeof body.date === "string" ? body.date : "";
  const earliest = todayISO(now);
  const latest = addISODays(earliest, 45);
  let dateDetail: string | undefined;
  let dateReason: "window" | "weekday" | "ended" | undefined;
  if (!isISODate(date) || date < earliest || date > latest) {
    fields.push("date");
    dateReason = "window";
    dateDetail = "Pick a date from today through the next 45 days.";
  } else if (batchOk && course) {
    const batchObj = course.batches.find((item) => item.id === batch);
    if (batchObj && batchHasEnded(batchObj.time, date, now)) {
      fields.push("date");
      dateReason = "ended";
      dateDetail = "That batch has already finished today. Pick another day.";
    } else if (batchObj && !batchObj.weekdays.includes(weekdayIndex(date))) {
      fields.push("date");
      dateReason = "weekday";
      const next = nextOpenDate(date, batchObj.weekdays, latest);
      const suggestion = next ? ` The next open day is ${formatLongDate(next)}.` : "";
      dateDetail = `That batch doesn't run on that day. ${batchObj.label} runs ${batchObj.days}.${suggestion}`;
    }
  }

  let email: string | undefined;
  if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) fields.push("email");
  }
  let spoken: "en" | "hi" | "pa" | undefined;
  if (body.language !== undefined && body.language !== null && body.language !== "") {
    if (body.language === "en" || body.language === "hi" || body.language === "pa") spoken = body.language;
    else fields.push("language");
  }

  if (fields.length || !phone || !course || !batchOk) {
    return {
      ok: false,
      status: 422,
      error: "invalid",
      message: invalidMessage(fields, dateDetail),
      fields,
      dateReason,
    };
  }

  const chosen = batch as BatchId;
  return {
    ok: true,
    booking: {
      name,
      phone,
      email,
      language: spoken,
      course: course.slug,
      batch: chosen,
      date,
      source: source ?? (body.source === "chat" ? "chat" : "form"),
    },
  };
}

function badJson(): Extract<SubmitResult, { ok: false }> {
  return {
    ok: false,
    status: 400,
    error: "bad_json",
    message: "Send the trial class details as JSON.",
  };
}

function connectionRateLimit(): Extract<SubmitResult, { ok: false }> {
  return {
    ok: false,
    status: 429,
    error: "rate_limit",
    limit: "ip",
    message: "Too many attempts from this connection. Wait ten minutes and try again.",
  };
}

function chargeJunk(ip: string | null, nowMs: number): boolean {
  if (!ip) return true;
  const key = `junk:${ip}`;
  const recent = (memoryAttempts.get(key) ?? []).filter((at) => nowMs - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    memoryAttempts.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  memoryAttempts.set(key, recent);
  return true;
}

function invalidMessage(fields: string[], dateDetail?: string): string {
  const core = fields.filter((field) => field !== "email");
  if (core.length >= 3) {
    return "Add the name, phone, course, batch, and date for the free trial class.";
  }
  if (fields.includes("phone")) {
    return "Use a 10-digit mobile number starting with 6, 7, 8, or 9.";
  }
  if (fields.includes("date")) {
    return dateDetail ?? "Pick a date from today through the next 45 days.";
  }
  if (fields.includes("email")) return "That email doesn’t look right. You can also leave it blank.";
  if (fields.includes("course") || fields.includes("batch")) {
    return "Pick a course and a batch that the centre actually runs.";
  }
  return "Add the name, phone, course, batch, and date for the free trial class.";
}

function nextId(bookings: Booking[]): string {
  const taken = new Set(bookings.map((booking) => booking.id));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const bytes = randomBytes(4);
    let id = "UA-";
    for (const byte of bytes) id += alphabet[byte % alphabet.length];
    if (!taken.has(id)) return id;
  }
  return `UA-${Date.now().toString(36).toUpperCase()}`;
}

async function notifyWebhook(url: string, booking: Booking): Promise<void> {
  const body = JSON.stringify({ type: "trial_class_request", booking });
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.BOOKING_WEBHOOK_SECRET?.trim();
  if (secret) headers["x-udaan-signature"] = createHmac("sha256", secret).update(body).digest("hex");
  try {
    await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // The request is already stored. A missed webhook can be read from the admin view.
  }
}

const memoryAttempts = new Map<string, number[]>();

export function resetMemoryAttemptsForTests(): void {
  memoryAttempts.clear();
}

export async function allowAttempt(options: {
  ip: string | null;
  kind: "chat" | "login";
  limit: number;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; limit: "ip" | "site" }> {
  const nowMs = (options.now ?? new Date()).getTime();
  const siteKey = `${options.kind}:site`;
  const siteLimit = options.kind === "chat" ? SITE_CHAT_LIMIT : SITE_LOGIN_LIMIT;
  const siteRecent = (memoryAttempts.get(siteKey) ?? []).filter((at) => nowMs - at < HOUR_MS);
  if (siteRecent.length >= siteLimit) {
    memoryAttempts.set(siteKey, siteRecent);
    return { ok: false, limit: "site" };
  }
  if (options.ip) {
    const key = `${options.kind}:${options.ip}`;
    const recent = (memoryAttempts.get(key) ?? []).filter((at) => nowMs - at < WINDOW_MS);
    if (recent.length >= options.limit) {
      memoryAttempts.set(key, recent);
      memoryAttempts.set(siteKey, siteRecent);
      return { ok: false, limit: "ip" };
    }
    recent.push(nowMs);
    memoryAttempts.set(key, recent);
  }
  siteRecent.push(nowMs);
  memoryAttempts.set(siteKey, siteRecent);
  return { ok: true };
}

let proxyWarned = false;

export function warnIfUntrustedProxy(): void {
  if (proxyWarned) return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1") return;
  proxyWarned = true;
  console.warn(
    "Udaan Academy is not on Vercel and TRUST_PROXY is unset, so per-IP rate limits are off. Per-phone limits and site-wide ceilings still apply. Set TRUST_PROXY=1 only behind a proxy that overwrites x-real-ip.",
  );
}

if (process.env.NODE_ENV === "production") warnIfUntrustedProxy();

export function acceptsBookingPost(request: Request): { ok: true } | { ok: false; status: 403 | 413 | 415; message: string } {
  const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") {
    return { ok: false, status: 415, message: "Send the trial class details as JSON." };
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return { ok: false, status: 403, message: "Cross-site request rejected." };
  }
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false, status: 403, message: "Cross-site request rejected." };
    }
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      new URL(request.url).host;
    if (originHost !== host) return { ok: false, status: 403, message: "Cross-site request rejected." };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > 4096) {
    return { ok: false, status: 413, message: "That request is too large." };
  }
  return { ok: true };
}

export async function handleBookingRequest(
  request: Request,
  options?: { now?: Date; webhookUrl?: string | null },
): Promise<Response> {
  const gate = acceptsBookingPost(request);
  if (!gate.ok) {
    return Response.json({ ok: false, error: "rejected", message: gate.message }, { status: gate.status });
  }
  const ip = clientIp(request);
  const now = options?.now ?? new Date();
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) {
      return Response.json({ ok: false, error: "too_large", message: "That request is too large." }, { status: 413 });
    }
    body = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (body === undefined) {
    const result = await submitBooking(undefined, { ip, now, webhookUrl: options?.webhookUrl ?? null });
    return Response.json(
      { ok: false, error: result.ok ? "bad_json" : result.error, message: result.ok ? "Send JSON." : result.message },
      { status: result.ok ? 400 : result.status },
    );
  }
  const result = await submitBooking(body, {
    ip,
    now,
    webhookUrl: options?.webhookUrl,
    source: (body as { source?: "form" | "chat" }).source === "chat" ? "chat" : "form",
  });
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.error,
        message: result.message,
        fields: result.fields,
        limit: result.limit,
        dateReason: result.dateReason,
      },
      { status: result.status },
    );
  }
  return Response.json({ ok: true, booking: publicBooking(result.booking) }, { status: 201 });
}

function publicBooking(booking: Booking) {
  return {
    id: booking.id,
    name: booking.name,
    phone: booking.phone,
    email: booking.email ?? null,
    language: booking.language ?? null,
    course: booking.course,
    courseName: academy.courses.find((course) => course.slug === booking.course)?.name ?? booking.course,
    batch: booking.batch,
    date: booking.date,
    createdAt: booking.createdAt,
    source: booking.source,
  };
}

export function futureDate(daysAhead: number, now = new Date()): string {
  return addISODays(todayISO(now), daysAhead);
}
