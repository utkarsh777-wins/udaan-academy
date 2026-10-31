"use client";

import Link from "next/link";
import { academy } from "@/lib/academy";
import { courseCopy, ui } from "@/lib/localize";
import { publicPhone } from "@/lib/site-language";
import { useSiteLang } from "@/components/language-provider";
import { LogoMark } from "@/components/marks";

export function SiteFooter() {
  const language = useSiteLang();
  const copy = ui(language);
  const hi = language === "hi";

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-12 min-[768px]:px-8 min-[1920px]:max-w-[1360px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-heading text-[21px] font-extrabold">{hi ? "उड़ान" : "Udaan"}</span>
          </Link>
          <p className="mt-4 max-w-[36ch] text-[15px] text-muted-foreground">
            {hi
              ? "IELTS, PTE, JEE, NEET फ़ाउंडेशन और पंजाब बोर्ड 9–12 की कोचिंग।"
              : "Coaching for IELTS and PTE, JEE and NEET foundation, and Punjab Board classes 9–12."}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">{hi ? "कोर्स" : "Courses"}</p>
          {academy.courses.map((course) => (
            <Link key={course.slug} href={`/courses/${course.slug}`} className="inline-flex min-h-11 items-center">
              {courseCopy(course, language).name}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">{hi ? "अकादमी" : "Academy"}</p>
          <Link href="/faculty" className="inline-flex min-h-11 items-center">{copy.navFaculty}</Link>
          <Link href="/fees" className="inline-flex min-h-11 items-center">{copy.navFees}</Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center">{hi ? "फ़्री ट्रायल" : "Free trial"}</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">{hi ? "संपर्क" : "Contact"}</p>
          <p className="num">{publicPhone(academy.phone)}</p>
          <p>{academy.email}</p>
          <p>{hi ? "जी.टी. रोड, फगवाड़ा" : "GT Road, Phagwara"}</p>
        </div>
      </div>
      <p className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground">© 2026 {hi ? "उड़ान अकादमी" : "Udaan Academy"}</p>
    </footer>
  );
}
