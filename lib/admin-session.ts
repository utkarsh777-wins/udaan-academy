import { createHmac, timingSafeEqual } from "node:crypto";

export const BOOKINGS_COOKIE = "udaan_bookings";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function createSessionToken(secret: string, now = Date.now()): string {
  const exp = now + EIGHT_HOURS_MS;
  const payload = String(exp);
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EIGHT_HOURS_MS / 1000,
  };
}
