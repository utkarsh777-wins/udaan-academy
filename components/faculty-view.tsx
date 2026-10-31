"use client";

import { useSiteLang } from "@/components/language-provider";

const subjects = {
  en: [
    ["IE", "IELTS & Spoken English"],
    ["PH", "Physics"],
    ["CB", "Chemistry & Biology"],
    ["MA", "Mathematics"],
    ["PB", "Punjab Board, Punjabi medium"],
    ["CO", "Admissions counsellor"],
  ],
  hi: [
    ["IE", "IELTS और स्पोकन इंग्लिश"],
    ["PH", "फ़िज़िक्स"],
    ["CB", "केमिस्ट्री और बायोलॉजी"],
    ["MA", "गणित"],
    ["PB", "पंजाब बोर्ड, पंजाबी माध्यम"],
    ["CO", "एडमिशन काउंसलर"],
  ],
} as const;

export function FacultyView() {
  const language = useSiteLang();
  const hi = language === "hi";
  const cards = hi ? subjects.hi : subjects.en;

  return (
    <main id="main">
      <div className="ruled border-b border-border py-14">
        <div className="mx-auto max-w-[1240px] px-5 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <p className="eyebrow">{hi ? "शिक्षक" : "Faculty"}</p>
          <h1 className="mt-3 font-heading text-[clamp(32px,4.2vw,50px)] font-bold">{hi ? "कौन क्या पढ़ाता है।" : "Who teaches what."}</h1>
          <p className="lead mt-3 max-w-[62ch] text-[19px] text-muted-foreground">
            {hi
              ? "हर शिक्षक अपनी प्रोफ़ाइल खुद लिखकर मंज़ूर करेगा। तब तक यहाँ सिर्फ़ विषय और भूमिका है।"
              : "Each teacher writes and approves their own profile. Until then, this page lists the subjects and the role, nothing more."}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1240px] px-5 py-14 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map(([mark, role]) => (
            <li key={mark} className="rounded-[14px] border border-border bg-card p-6">
              <div className="grid aspect-[4/3] place-items-center rounded-[10px] border border-dashed border-border bg-muted">
                <span className="font-heading text-3xl text-muted-foreground">{mark}</span>
              </div>
              <p className="eyebrow mt-4">{hi ? "विषय" : "Subject"}</p>
              <h2 className="mt-1 font-heading text-xl">{role}</h2>
              <p className="mt-1 text-sm text-muted-foreground italic">{hi ? "प्रोफ़ाइल जोड़ी जाएगी।" : "Faculty profile to be added."}</p>
            </li>
          ))}
        </ul>
        <article className="mt-10 rounded-[14px] border border-border bg-card p-6">
          <h2 className="font-heading text-2xl font-bold">{hi ? "प्रोफ़ाइल में क्या होगा" : "What each profile will show"}</h2>
          <ul className="mt-4">
            {(hi
              ? ["विषय और बैच", "अनुभव, उनके अपने शब्दों में", "पढ़ाने की भाषाएँ", "डाउट का समय"]
              : ["Subjects and batches they teach", "Teaching experience, in their own words", "Languages they teach in", "Doubt-hour timing"]
            ).map((item) => (
              <li key={item} className="relative border-b border-border py-3 pl-7 before:absolute before:top-5 before:left-1 before:h-px before:w-3 before:bg-margin">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </main>
  );
}
