import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { BOOKINGS_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/admin-session";
import { allowAttempt, clientIp } from "@/lib/bookings";

export async function POST(request: Request) {
  await connection();
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 4096) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const secret = process.env.BOOKINGS_VIEW_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "unconfigured", message: "Set BOOKINGS_VIEW_SECRET to open this view." },
      { status: 404 },
    );
  }
  const body = (await request.json().catch(() => null)) as { secret?: unknown } | null;
  const given = typeof body?.secret === "string" ? body.secret : "";
  if (safeEqual(given, secret)) {
    const jar = await cookies();
    jar.set(BOOKINGS_COOKIE, createSessionToken(secret), sessionCookieOptions());
    return Response.json({ ok: true });
  }
  const decision = await allowAttempt({ ip: clientIp(request), kind: "login", limit: 5 });
  if (!decision.ok) {
    return Response.json({ ok: false, error: "rate_limit", limit: decision.limit }, { status: 429 });
  }
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function DELETE() {
  await connection();
  const jar = await cookies();
  jar.delete(BOOKINGS_COOKIE);
  return Response.json({ ok: true });
}

function safeEqual(given: string, secret: string): boolean {
  const left = createHmac("sha256", "udaan-view").update(given).digest();
  const right = createHmac("sha256", "udaan-view").update(secret).digest();
  return timingSafeEqual(left, right);
}
