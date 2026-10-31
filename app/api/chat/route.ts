import { connection } from "next/server";
import { bookingErrorReply, counsel, savedBookingReply, type Draft } from "@/lib/chat/respond";
import { askCounsellor, claimsConfirmation } from "@/lib/chat/llm";
import { acceptsBookingPost, allowAttempt, clientIp, handleBookingRequest } from "@/lib/bookings";
import type { BatchId, Language } from "@/lib/academy";

export async function POST(request: Request) {
  await connection();
  const gate = acceptsBookingPost(request);
  if (!gate.ok) {
    return Response.json({ error: "rejected", message: gate.message }, { status: gate.status });
  }
  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) {
      return Response.json({ error: "too_large" }, { status: 413 });
    }
    payload = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const body = payload as {
    message?: unknown;
    language?: unknown;
    draft?: unknown;
    history?: unknown;
  };
  if (typeof body.message !== "string") {
    return Response.json({ error: "message" }, { status: 400 });
  }
  const message = body.message.trim();
  if (!message || message.length > 1000) {
    return Response.json({ error: "message" }, { status: 400 });
  }
  const language: Language = body.language === "hi" || body.language === "pa" ? body.language : "en";
  const draft = sanitizeDraft(body.draft);
  const decision = await allowAttempt({ ip: clientIp(request), kind: "chat", limit: 20 });
  if (!decision.ok) {
    return Response.json(
      {
        reply: chatLimitReply(language, decision.limit),
        draft,
        limit: decision.limit,
        source: "fallback",
        booking: null,
      },
      { status: 429 },
    );
  }
  const history = sanitizeHistory(body.history);
  const result = counsel({ text: message, language, draft });

  if (result.ready && result.draft.name && result.draft.phone && result.draft.course && result.draft.batch && result.draft.date) {
    const bookingResponse = await handleBookingRequest(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          name: result.draft.name,
          phone: result.draft.phone,
          course: result.draft.course,
          batch: result.draft.batch,
          date: result.draft.date,
          source: "chat",
        }),
      }),
    );
    const saved = (await bookingResponse.json()) as {
      ok?: boolean;
      error?: "rate_limit" | "duplicate_phone" | "invalid" | "bad_json";
      message?: string;
      fields?: string[];
      limit?: "phone" | "ip" | "site";
      dateReason?: "window" | "weekday" | "ended";
      booking?: { id: string; name: string; course: string; batch: BatchId; date: string };
    };
    if (!bookingResponse.ok || !saved.booking) {
      const error = saved.error ?? "invalid";
      return Response.json({
        reply: bookingErrorReply(
          language,
          error,
          language === "en" ? saved.message : undefined,
          saved.fields,
          saved.limit,
          saved.dateReason,
        ),
        draft: error === "duplicate_phone" ? {} : clearFields(result.draft, saved.fields),
        source: "fallback",
        booking: null,
      });
    }
    return Response.json({
      reply: savedBookingReply(language, saved.booking),
      draft: {},
      source: "fallback",
      booking: { id: saved.booking.id },
    });
  }

  if (
    result.intent !== "book" &&
    result.intent !== "admission" &&
    result.intent !== "eligibility" &&
    result.intent !== "status"
  ) {
    const llm = await askCounsellor({ language, history, message });
    if (llm && !claimsConfirmation(llm)) {
      return Response.json({
        reply: closeSentence(language, llm),
        draft: result.draft,
        source: "llm",
        booking: null,
      });
    }
  }

  return Response.json({
    reply: result.reply,
    draft: result.draft,
    source: "fallback",
    booking: null,
  });
}

function chatLimitReply(language: Language, limit: "ip" | "site"): string {
  if (limit === "site") {
    if (language === "hi") return "इस घंटे में साइट पर बहुत संदेश आ चुके हैं। थोड़ी देर बाद फिर लिखिए।";
    if (language === "pa") return "ਇਸ ਘੰਟੇ ਵਿੱਚ ਸਾਈਟ ਉੱਤੇ ਬਹੁਤ ਸੁਨੇਹੇ ਆ ਚੁੱਕੇ ਹਨ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਲਿਖੋ।";
    return "Too many messages on the site this hour. Try again later.";
  }
  if (language === "hi") return "इस कनेक्शन से बहुत संदेश आ चुके हैं। दस मिनट रुक कर फिर लिखिए।";
  if (language === "pa") return "ਇਸ ਕਨੈਕਸ਼ਨ ਤੋਂ ਬਹੁਤ ਸੁਨੇਹੇ ਆ ਚੁੱਕੇ ਹਨ। ਦਸ ਮਿੰਟ ਰੁਕ ਕੇ ਫਿਰ ਲਿਖੋ।";
  return "Too many messages from this connection. Wait ten minutes and try again.";
}

function sanitizeDraft(value: unknown): Draft {
  if (!value || typeof value !== "object") return {};
  const body = value as Record<string, unknown>;
  const draft: Draft = {};
  if (body.active === true) draft.active = true;
  if (body.confirming === true) draft.confirming = true;
  if (typeof body.name === "string") draft.name = body.name.slice(0, 80);
  if (typeof body.phone === "string") draft.phone = body.phone.slice(0, 20);
  if (typeof body.course === "string") draft.course = body.course.slice(0, 60);
  if (body.batch === "morning" || body.batch === "evening" || body.batch === "weekend") draft.batch = body.batch;
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) draft.date = body.date;
  return draft;
}

function sanitizeHistory(value: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-8)
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const item = turn as { role?: unknown; content?: unknown };
      if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return null;
      return { role: item.role, content: item.content.slice(0, 1000) };
    })
    .filter((turn): turn is { role: "user" | "assistant"; content: string } => Boolean(turn));
}

function clearFields(draft: Draft, fields?: string[]): Draft {
  const next: Draft = { ...draft, confirming: false };
  for (const field of fields ?? []) {
    if (field === "name") next.name = undefined;
    if (field === "phone") next.phone = undefined;
    if (field === "course") next.course = undefined;
    if (field === "batch") next.batch = undefined;
    if (field === "date") next.date = undefined;
  }
  return next;
}

function closeSentence(language: Language, text: string): string {
  const trimmed = text.trim();
  if (language === "en" || /[।.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}।`;
}
