"use client";

import { ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";

export function CoursesIntro() {
  const language = useSiteLang();
  const copy = ui(language);
  const hi = language === "hi";
  return (
    <div className="ruled border-b border-border py-14">
      <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
        <p className="eyebrow">{copy.coursesTitle}</p>
        <h1 className="mt-3 font-heading text-[clamp(32px,4.2vw,50px)] font-bold">
          {hi ? "पाँच कोर्स, हर फ़ीस लिखी हुई।" : "Five courses, every fee listed."}
        </h1>
        <p className="lead mt-3 max-w-[56ch] text-[19px] text-muted-foreground">{copy.coursesIntro}</p>
      </div>
    </div>
  );
}
