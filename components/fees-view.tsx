"use client";

import Link from "next/link";
import { useState } from "react";
import { academy, formatFeeRange } from "@/lib/academy";
import { courseCopy, goalCopy, textBlocks } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { cn } from "@/lib/utils";

export function FeesView() {
  const language = useSiteLang();
  const blocks = textBlocks(language);
  const hi = language === "hi";
  const [filters, setFilters] = useState<string[]>([]);
  const goals = goalCopy(language);
  const headers = hi ? ["कोर्स", "किसके लिए", "फ़ीस", "बैच"] : ["Course", "For", "Fee", "Batches"];
  const rows = academy.courses.map((course) => ({ slug: course.slug, ...courseCopy(course, language) }));

  function toggle(id: string) {
    setFilters((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <main id="main">
      <div className="ruled border-b border-border py-14">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <p className="eyebrow">{hi ? "फ़ीस और बैच" : "Fees & batches"}</p>
          <h1 className="mt-3 font-heading text-[clamp(32px,4.2vw,50px)] font-bold">{hi ? "फ़ीस पहले से लिखी है।" : "Fees before you ask."}</h1>
          <p className="lead mt-3 max-w-[62ch] text-[19px] text-muted-foreground">{blocks.pages.feesIntro}</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-5 py-14 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
        <div className="hidden overflow-x-auto rounded-[14px] border border-border min-[768px]:block">
          <table className="w-full min-w-[40rem] text-[15.5px]">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {headers.map((label) => (
                  <th key={label} scope="col" className="eyebrow px-5 py-3 text-left font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((shown) => (
                <tr key={shown.slug} className="border-t border-border">
                  <td className="px-5 py-3.5 font-medium">{shown.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{shown.eligibility}</td>
                  <td className="num px-5 py-3.5">{shown.fees.map((fee) => formatFeeRange(fee, language)).join(" · ")}</td>
                  <td className="px-5 py-3.5">{shown.batches.map((batch) => batch.label).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul aria-label={hi ? "फ़ीस और बैच" : "Fees and batches"} className="divide-y divide-border rounded-[14px] border border-border min-[768px]:hidden">
          {rows.map((shown) => (
            <li key={shown.slug} className="px-5 py-4">
              <p className="font-medium">{shown.name}</p>
              <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
                <dt className="text-muted-foreground">{headers[1]}</dt>
                <dd className="min-w-0 text-muted-foreground">{shown.eligibility}</dd>
                <dt className="text-muted-foreground">{headers[2]}</dt>
                <dd className="num min-w-0">
                  {shown.fees.map((fee) => (
                    <span key={fee.label} className="block">
                      {shown.fees.length > 1 ? `${fee.label}: ` : ""}
                      {formatFeeRange(fee, language)}
                    </span>
                  ))}
                </dd>
                <dt className="text-muted-foreground">{headers[3]}</dt>
                <dd className="min-w-0">{shown.batches.map((batch) => batch.label).join(" · ")}</dd>
              </dl>
            </li>
          ))}
        </ul>

        <div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-heading text-[clamp(24px,3vw,36px)] font-bold">{hi ? "बैच टाइमिंग" : "Batch timings"}</h2>
            <div className="flex flex-wrap gap-1.5">
              {["morning", "evening", "weekend"].map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filters.includes(id)}
                  onClick={() => toggle(id)}
                  className={cn(
                    "h-[38px] rounded-full border px-4 text-sm",
                    filters.includes(id) ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {id === "morning" ? (hi ? "सुबह" : "Morning") : id === "evening" ? (hi ? "शाम" : "Evening") : hi ? "वीकेंड" : "Weekend"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {academy.courses.map((course) => {
              const shown = courseCopy(course, language);
              const fee = shown.fees[0];
              const track = goals.find((item) => item.id === course.goal)?.label;
              return (
                <article key={course.slug} className="overflow-hidden rounded-[14px] border border-border bg-card">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
                    <div>
                      <p className="eyebrow">{track}</p>
                      <h3 className="font-heading text-[22px] font-bold">{shown.name}</h3>
                      <p className="text-sm text-muted-foreground">{shown.duration}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-[26px] font-bold">{fee ? formatFeeRange(fee, language) : ""}</p>
                      <Link href={`/contact?course=${course.slug}`} className="mt-2 inline-flex h-9 items-center rounded-[10px] border border-border px-3 text-sm font-semibold">
                        {hi ? "ट्रायल बुक करें" : "Book trial"}
                      </Link>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3">
                    {shown.batches.map((batch) => {
                      const dim = filters.length > 0 && !filters.includes(batch.id);
                      return (
                        <div key={batch.id} className={cn("border-b border-border p-5 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0", dim && "opacity-40")}>
                          <p className="text-sm font-semibold">{batch.label}</p>
                          <p className="num mt-1">{batch.time}</p>
                          <p className="text-sm text-muted-foreground">{batch.days}</p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <article className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-border bg-card p-6">
          <p className="max-w-xl text-muted-foreground">
            {hi
              ? "फ़ीस डेस्क पर नकद, यूपीआई या कार्ड से। यह साइट पेमेंट नहीं लेती और ईमेल नहीं भेजती।"
              : "Cash, UPI or card at the front desk. This site does not take payment and does not send email."}
          </p>
          <Link href="/contact" className="inline-flex h-11 items-center rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground">
            {hi ? "फ़्री ट्रायल बुक करें" : "Book a free trial"} →
          </Link>
        </article>
      </div>
    </main>
  );
}
