"use client";

import Link from "next/link";
import { formatFeeRange, getCourse } from "@/lib/academy";
import { courseCopy, goalCopy, ui } from "@/lib/localize";
import { formatLongDate } from "@/lib/dates";
import { bookableDates } from "@/lib/schedule";
import { useSiteLang } from "@/components/language-provider";
import { Ticket } from "@/components/ticket";
import { useChatOpen } from "@/components/chat-state";

export function CourseView({ slug }: { slug: string }) {
  const language = useSiteLang();
  const copy = ui(language);
  const chatOpen = useChatOpen();
  const course = getCourse(slug);
  const hi = language === "hi";
  if (!course) return null;
  const shown = courseCopy(course, language);
  const track = goalCopy(language).find((item) => item.id === course.goal)?.label ?? course.goal;
  const fee = shown.fees[0];
  const first = shown.batches[0];
  const firstDate = first ? bookableDates(first.weekdays, first.time)[0] : undefined;

  return (
    <main id="main">
      <div className="ruled border-b border-border py-14">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <p className="text-sm text-muted-foreground">
            <Link href="/courses">{copy.courseBack}</Link> / {track}
          </p>
          <h1 className="mt-3 font-heading text-[clamp(32px,4.2vw,50px)] font-bold">{shown.name}</h1>
          <p className="lead mt-3 max-w-[62ch] text-[19px] text-muted-foreground">{shown.summary}</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-10 px-5 py-14 min-[768px]:px-8 min-[1920px]:max-w-[1360px] lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div>
          <dl className="grid gap-6 sm:grid-cols-3">
            {[
              [hi ? "किसके लिए" : "Who it's for", shown.eligibility],
              [hi ? "ड्यूरेशन" : "Duration", shown.duration],
              [hi ? "फ़ीस" : "Fee", fee ? formatFeeRange(fee, language) : ""],
            ].map(([label, value]) => (
              <div key={label} className="border-t border-foreground pt-3">
                <dt className="eyebrow">{label}</dt>
                <dd className="mt-2 text-lg">{value}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-12 font-heading text-2xl font-bold">{hi ? "कोर्स में क्या है" : "What the course covers"}</h2>
          <ul className="mt-4">
            {shown.includes.map((item) => (
              <li key={item} className="relative border-b border-border py-3 pl-7 before:absolute before:top-5 before:left-1 before:h-px before:w-3 before:bg-margin">
                {item}
              </li>
            ))}
          </ul>
          <h2 className="mt-12 font-heading text-2xl font-bold">{copy.batches}</h2>
          <article className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <p className="eyebrow">{track}</p>
                <h3 className="font-heading text-[22px] font-bold">{shown.name}</h3>
                <p className="text-sm text-muted-foreground">{shown.duration}</p>
              </div>
              <p className="font-heading text-[26px] font-bold">{fee ? formatFeeRange(fee, language) : ""}</p>
            </div>
            <div className="grid md:grid-cols-3">
              {shown.batches.map((batch) => (
                <div key={batch.id} className="border-b border-border p-5 md:border-r md:border-b-0 last:border-0">
                  <p className="text-sm font-semibold">{batch.label}</p>
                  <p className="num mt-1 text-[15px]">{batch.time}</p>
                  <p className="text-sm text-muted-foreground">{batch.days}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Ticket
            label={copy.ticketLabel}
            eyebrow={hi ? "फ़्री ट्रायल क्लास" : "Free trial class"}
            from={hi ? "फगवाड़ा" : "Phagwara"}
            to={track}
            fields={[
              { label: hi ? "कोर्स" : "Course", value: shown.name },
              { label: hi ? "बैच" : "Batch", value: first?.label ?? "—" },
              { label: hi ? "तारीख" : "Date", value: firstDate ? formatLongDate(firstDate, language) : "—", mono: true },
              { label: hi ? "टाइम" : "Time", value: first?.time ?? "—", mono: true },
            ]}
          />
          <Link href={`/contact?course=${course.slug}`} className="mt-4 inline-flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary font-semibold text-primary-foreground hover:bg-primary-hover">
            {hi ? "यह फ़्री ट्रायल बुक करें" : "Book this free trial"} →
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">{hi ? "ऑनलाइन पेमेंट नहीं। फ़ीस डेस्क पर।" : "No online payment. Fees are paid at the front desk."}</p>
        </aside>
      </div>
      {chatOpen ? null : (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 lg:hidden">
          <p className="text-sm">
            <span className="text-muted-foreground">{hi ? "फ़्री ट्रायल" : "Free trial"} · </span>
            {shown.name}
          </p>
          <Link href={`/contact?course=${course.slug}`} className="mr-16 inline-flex h-11 items-center rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground">
            {hi ? "बुक" : "Book"}
          </Link>
        </div>
      )}
    </main>
  );
}
