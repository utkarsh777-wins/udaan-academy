"use client";

import { academy } from "@/lib/academy";
import { courseCopy, ui } from "@/lib/localize";
import type { Booking } from "@/lib/bookings";
import { formatLongDate } from "@/lib/dates";
import { useSiteLang } from "@/components/language-provider";
import { AdminLogin, AdminLogout } from "@/components/admin-login";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function BookingsIntro() {
  const copy = ui(useSiteLang());
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-4xl font-semibold tracking-tight">{copy.bookingsTitle}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{copy.bookingsIntro}</p>
    </div>
  );
}

export function BookingsClosed() {
  const copy = ui(useSiteLang());
  return (
    <Alert>
      <AlertTitle>{copy.viewClosedTitle}</AlertTitle>
      <AlertDescription>{copy.viewClosedBody}</AlertDescription>
    </Alert>
  );
}

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const language = useSiteLang();
  const copy = ui(language);

  return (
    <div className="flex flex-col gap-4">
      <AdminLogout />
      {bookings.length === 0 ? (
        <p className="text-muted-foreground">{copy.noRequests}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{copy.savedCaption}</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  {copy.colReference}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colName}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colPhone}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colCourse}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colBatch}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colDate}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colReceived}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {copy.colSource}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {language === "hi" ? "भाषा" : "Language"}
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const course = academy.courses.find((item) => item.slug === booking.course);
                const shown = course ? courseCopy(course, language) : null;
                const batch = shown?.batches.find((item) => item.id === booking.batch);
                return (
                  <tr key={booking.id} className="border-t border-border">
                    <th scope="row" className="py-2 font-medium whitespace-nowrap">
                      {booking.id}
                    </th>
                    <td className="py-2">{booking.name}</td>
                    <td className="py-2">{booking.phone}</td>
                    <td className="py-2">{shown?.name ?? booking.course}</td>
                    <td className="py-2">{batch ? `${batch.label} · ${batch.days}` : booking.batch}</td>
                    <td className="py-2">{formatLongDate(booking.date, language)}</td>
                    <td className="py-2">{formatLongDate(booking.createdAt.slice(0, 10), language)}</td>
                    <td className="py-2">{booking.source}</td>
                    <td className="py-2">{booking.language ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function BookingsLogin() {
  return <AdminLogin />;
}
