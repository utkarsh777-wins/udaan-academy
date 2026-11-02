"use client";

import Link from "next/link";
import { academy, formatFeeRange } from "@/lib/academy";
import { courseCopy, textBlocks, ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { RoadMap } from "@/components/marks";

const routeOrder = ["ielts-pte", "jee-foundation", "neet-foundation", "punjab-board"] as const;

export function HomeView() {
  const language = useSiteLang();
  const copy = ui(language);
  const blocks = textBlocks(language);
  const hi = language === "hi";

  return (
    <main id="main">
      <section className="ruled border-b border-border py-12 lg:py-20">
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px] lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <svg className="pointer-events-none absolute top-0 right-0 hidden h-full w-[min(46vw,620px)] lg:block" viewBox="0 0 620 420" aria-hidden="true">
            <path d="M20 380 C 180 300, 280 180, 580 40" fill="none" stroke="var(--primary)" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="5 7" />
          </svg>
          <div>
            <p className="eyebrow">{hi ? "जी.टी. रोड, फगवाड़ा · IELTS · JEE · NEET · PSEB" : "GT Road, Phagwara · IELTS · JEE · NEET · PSEB"}</p>
            <h1 className="mt-4 max-w-[16ch] font-heading text-[clamp(30px,5.2vw,60px)] leading-[1.08] font-extrabold">
              {hi ? "आने वाले एग्ज़ाम के लिए छोटे बैच।" : "Small batches for the exam in front of you."}
            </h1>
            <p className="lead mt-5 max-w-[56ch] text-[19px] text-muted-foreground">{blocks.pages.heroBody}</p>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row">
              <Link href="/contact" className="inline-flex h-[52px] items-center justify-center rounded-[10px] bg-primary px-6 text-[16.5px] font-semibold text-primary-foreground hover:bg-primary-hover">
                {hi ? "फ़्री ट्रायल क्लास बुक करें" : "Book a free trial class"} <span className="ml-2">→</span>
              </Link>
              <Link href="/courses" className="inline-flex h-[52px] items-center justify-center rounded-[10px] border border-border bg-card px-6 text-[16.5px] font-semibold">
                {hi ? "कोर्स देखें" : "See courses"}
              </Link>
            </div>
            <p className="mt-7 flex flex-wrap gap-x-6 text-[14.5px] text-muted-foreground">
              <span>{hi ? "फ़ीस पहले से लिखी है" : "Fees shown upfront"}</span>
              <span>{hi ? "काउंसलिंग अंग्रेज़ी, हिंदी और ਪੰਜਾਬੀ में" : "Counselling in English, हिंदी, ਪੰਜਾਬੀ"}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[14px] border border-border bg-card shadow-md">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
              <strong className="font-semibold">{hi ? "बैच टाइमिंग" : "Batch timings"}</strong>
              <span className="num text-[13px] text-muted-foreground">{hi ? "नवंबर 2026" : "Nov 2026"}</span>
            </div>
            <table className="w-full text-[14.5px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="eyebrow px-5 py-2 text-left font-medium">{hi ? "कोर्स" : "Course"}</th>
                  <th className="eyebrow px-5 py-2 text-left font-medium">{hi ? "बैच" : "Batch"}</th>
                  <th className="eyebrow px-5 py-2 text-left font-medium">{hi ? "टाइम" : "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {academy.courses.map((course) => {
                  const shown = courseCopy(course, language);
                  const batch = shown.batches[0];
                  return (
                    <tr key={course.slug} className="border-t border-border">
                      <td className="px-5 py-3">
                        <span className="font-medium">{shown.name}</span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">{batch?.days}</span>
                      </td>
                      <td className="px-5 py-3">{batch?.label}</td>
                      <td className="num px-5 py-3 whitespace-nowrap">{batch?.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted px-5 py-3 text-[13.5px] text-muted-foreground">
              <span>{hi ? "पहली क्लास फ़्री है। फ़ीस सिर्फ़ डेस्क पर।" : "First class is free. Pay only at the front desk."}</span>
              <Link href="/fees" className="font-semibold text-primary">{hi ? "सभी बैच" : "All batches"}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{hi ? "अपना रास्ता चुनिए" : "Choose your route"}</p>
              <h2 className="mt-2 font-heading text-[clamp(24px,3vw,36px)] font-bold">{hi ? "चार रास्ते, जी.टी. रोड पर एक ही बिल्डिंग।" : "Four routes, one building on GT Road."}</h2>
              <p className="mt-2 max-w-[52ch] text-muted-foreground">{hi ? "हर कोर्स अपनी फ़ीस और बैच पहले बताता है।" : "Every course lists its batches and its fee before you ask."}</p>
            </div>
            <Link href="/courses" className="inline-flex h-11 items-center rounded-[10px] border border-border px-4 font-semibold">
              {hi ? "पाँचों कोर्स" : "All five courses"} →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {routeOrder.map((slug) => {
              const course = academy.courses.find((item) => item.slug === slug);
              if (!course) return null;
              const shown = courseCopy(course, language);
              const fee = shown.fees[0];
              return (
                <Link key={slug} href={`/courses/${slug}`} className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md">
                  <p className="eyebrow flex items-center gap-2">
                    {hi ? "फगवाड़ा" : "Phagwara"} <i className="h-px w-4 border-t border-dashed border-muted-foreground" /> {shown.name}
                  </p>
                  <h3 className="font-heading text-[22px] font-bold">{shown.name}</h3>
                  <p className="text-[15.5px] text-muted-foreground">{shown.summary}</p>
                  <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 border-t border-border pt-3.5 text-sm">
                    <dt className="text-muted-foreground">{hi ? "फ़ीस" : "Fee"}</dt>
                    <dd className="text-right font-medium">{fee ? formatFeeRange(fee, language) : ""}</dd>
                    <dt className="text-muted-foreground">{hi ? "बैच" : "Batches"}</dt>
                    <dd className="text-right">{shown.batches.length}</dd>
                  </dl>
                  <span className="font-semibold text-primary">{hi ? "कोर्स डिटेल" : "Course details"} →</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <h2 className="mb-8 font-heading text-[clamp(24px,3vw,36px)] font-bold">
            {hi ? "फ़ीस देने से पहले एक असली क्लास में बैठिए।" : "Sit in one real class before you pay anything."}
          </h2>
          <ol className="grid border-t border-foreground md:grid-cols-3">
            {[
              [hi ? "कोर्स और बैच चुनिए" : "Pick a course and batch", hi ? "टाइम और फ़ीस पेज पर लिखी है।" : "The time and the fee are already on the page."],
              [hi ? "एक पूरी क्लास में बैठिए" : "Attend one full class", hi ? "सीट डेस्क पर रखी जाती है।" : "The front desk holds the seat."],
              [hi ? "डेस्क पर तय कीजिए" : "Decide at the desk", hi ? "ऑनलाइन पेमेंट नहीं। एडमिशन लेंगे, तभी फ़ीस देनी होगी।" : "No online payment. Pay only if you enrol."],
            ].map(([title, body], index) => (
              <li key={title} className="border-b border-border py-6 md:border-r md:border-b-0 md:pr-7 md:pl-0 last:md:border-r-0">
                <p className="num text-[13px] text-margin">Q{index + 1}.</p>
                <h3 className="mt-2 font-heading text-xl font-bold">{title}</h3>
                <p className="mt-2 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <h2 className="mb-8 font-heading text-[clamp(24px,3vw,36px)] font-bold">{hi ? "सीधे वादे, जो हम निभा सकते हैं।" : "Plain promises we can keep."}</h2>
          <div className="grid overflow-hidden rounded-[14px] border border-border bg-card md:grid-cols-3">
            {(hi
              ? [
                  ["छोटे बैच", "क्लास में बात सुनी जा सके, इतना छोटा ग्रुप।"],
                  ["डाउट का फिक्स टाइम", "शाम के बैच के बाद और रविवार सुबह।"],
                  ["मॉक टेस्ट प्रैक्टिस है", "स्कोर का अनुमान नहीं।"],
                  ["फ़ीस लिखी हुई है", "जो यहाँ नहीं लिखा, वह डेस्क पर नहीं जुड़ता।"],
                  ["तीन भाषाएँ", "अंग्रेज़ी, हिंदी और पंजाबी।"],
                  ["जी.टी. रोड पर", "फगवाड़ा, LPU से थोड़ी दूर।"],
                ]
              : [
                  ["Small batches", "Small enough that the teacher can hear you."],
                  ["A fixed doubt hour", "After the evening batch, and Sunday morning."],
                  ["Mocks are practice", "A mock is not a predicted score."],
                  ["Fees on the wall", "Nothing is added at the desk that is not written here."],
                  ["Three languages", "English, Hindi and Punjabi."],
                  ["On GT Road", blocks.location.area],
                ]
            ).map(([title, body]) => (
              <div key={title} className="border-b border-border p-6 md:border-r last:border-b-0 md:[&:nth-child(3n)]:border-r-0">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-[15.5px] text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-[clamp(24px,3vw,36px)] font-bold">{hi ? "कौन क्या पढ़ाता है" : "Who teaches what."}</h2>
              <p className="mt-2 text-muted-foreground">{hi ? "प्रोफ़ाइल तब जोड़ी जाएगी जब टीचर खुद मंज़ूर करें।" : "Teacher profiles are added once each teacher approves their own text."}</p>
            </div>
            <Link href="/faculty" className="font-semibold text-primary">{hi ? "फैकल्टी" : "Faculty page"} →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["IE", hi ? "IELTS और स्पोकन इंग्लिश" : "IELTS & Spoken English"],
              ["PH", hi ? "फ़िज़िक्स" : "Physics"],
              ["CB", hi ? "केमिस्ट्री और बायोलॉजी" : "Chemistry & Biology"],
              ["MA", hi ? "मैथ्स" : "Mathematics"],
            ].map(([mark, role]) => (
              <article key={mark} className="rounded-[14px] border border-border bg-card p-6">
                <div className="grid aspect-[4/3] place-items-center rounded-[10px] border border-dashed border-border bg-muted">
                  <span className="font-heading text-3xl text-muted-foreground">{mark}</span>
                </div>
                <p className="eyebrow mt-4">{hi ? "सब्जेक्ट" : "Subject"}</p>
                <h3 className="mt-1 font-heading text-xl">{role}</h3>
                <p className="mt-1 text-sm text-muted-foreground italic">{hi ? "प्रोफ़ाइल जोड़ी जाएगी।" : "Faculty profile to be added."}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[860px] px-5 min-[768px]:px-8">
          <h2 className="mb-6 font-heading text-[clamp(24px,3vw,36px)] font-bold">{copy.homeFaq}</h2>
          <div className="divide-y divide-border border-y border-border">
            {blocks.faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0} className="py-4">
                <summary className="cursor-pointer text-lg font-semibold">{faq.question}</summary>
                <p className="mt-2 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="visit" className="py-14 lg:py-[88px]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px] lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-[clamp(24px,3vw,36px)] font-bold">{hi ? "खुलने का टाइम" : "Opening hours"}</h2>
            <dl className="mt-6 space-y-3 text-[16px]">
              <div><dt className="text-muted-foreground">{hi ? "पता" : "Address"}</dt><dd>{blocks.location.lines[0]}</dd></div>
              <div><dt className="text-muted-foreground">{hi ? "फ़ोन" : "Phone"}</dt><dd className="num">{academy.phone.replace(/\s*\(sample\)\s*/i, "")}</dd></div>
              <div><dt className="text-muted-foreground">{hi ? "टाइम" : "Hours"}</dt><dd>{blocks.hours}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex h-11 items-center rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground">{hi ? "फ़्री ट्रायल बुक करें" : "Book free trial"}</Link>
              <a href="#visit" className="inline-flex h-11 items-center rounded-[10px] border border-border px-4 font-semibold">{hi ? "रास्ता देखें" : "Get directions"}</a>
            </div>
          </div>
          <RoadMap language={language} />
        </div>
      </section>
    </main>
  );
}
