import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { BOOKINGS_COOKIE, verifySessionToken } from "@/lib/admin-session";
import { listBookings } from "@/lib/bookings";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";
import { BookingsClosed, BookingsIntro, BookingsLogin, BookingsTable } from "@/components/bookings-view";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  return { title: ui(language).metaBookingsTitle, robots: { index: false, follow: false } };
}

export default function BookingsPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <BookingsIntro />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  await connection();
  const secret = process.env.BOOKINGS_VIEW_SECRET;
  if (!secret) return <BookingsClosed />;
  const token = (await cookies()).get(BOOKINGS_COOKIE)?.value;
  if (!verifySessionToken(token, secret)) return <BookingsLogin />;
  const bookings = await listBookings();
  return <BookingsTable bookings={bookings} />;
}
