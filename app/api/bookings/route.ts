import { cookies } from "next/headers";
import { connection } from "next/server";
import { handleBookingRequest, listBookings } from "@/lib/bookings";
import { BOOKINGS_COOKIE, verifySessionToken } from "@/lib/admin-session";

export async function POST(request: Request) {
  await connection();
  return handleBookingRequest(request, {
    webhookUrl: process.env.BOOKING_WEBHOOK_URL,
  });
}

export async function GET() {
  await connection();
  const secret = process.env.BOOKINGS_VIEW_SECRET;
  const token = (await cookies()).get(BOOKINGS_COOKIE)?.value;
  if (!secret || !verifySessionToken(token, secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const bookings = await listBookings();
  return Response.json({ ok: true, bookings });
}
