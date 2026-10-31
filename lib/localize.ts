import hindiJson from "@/content/academy.hi.json";
import { uiCopy, type UiCopy } from "@/content/ui-copy";
import { academy, getCourse, type BatchId, type Course } from "@/lib/academy";
import type { SiteLanguage } from "@/lib/site-language";

const dayHi: Record<string, string> = {
  "Mon–Fri": "सोम–शुक्र",
  "Mon–Sat": "सोम–शनि",
  "Sat–Sun": "शनि–रवि",
};

const batchHi: Record<BatchId, string> = {
  morning: "सुबह",
  evening: "शाम",
  weekend: "वीकेंड",
};

export function ui(language: SiteLanguage): UiCopy {
  return uiCopy[language];
}

export function textBlocks(language: SiteLanguage) {
  if (language === "en") {
    return {
      tagline: academy.tagline,
      phoneNote: academy.phoneNote,
      emailNote: academy.emailNote,
      hours: academy.hours,
      location: academy.location,
      pages: academy.pages,
      results: academy.results,
      why: academy.why,
      facilities: academy.facilities,
      faqs: academy.faqs,
      upcomingNote: "Open for a free trial class",
    };
  }
  return {
    tagline: hindiJson.tagline,
    phoneNote: hindiJson.phoneNote,
    emailNote: hindiJson.emailNote,
    hours: hindiJson.hours,
    location: hindiJson.location,
    pages: hindiJson.pages,
    results: hindiJson.results,
    why: hindiJson.why,
    facilities: academy.facilities.map((item) => hindiJson.facilities[item.id as keyof typeof hindiJson.facilities]),
    faqs: hindiJson.faqs,
    upcomingNote: hindiJson.upcomingNote,
  };
}

export function goalCopy(language: SiteLanguage) {
  return academy.goals.map((goal) => {
    if (language === "en") return goal;
    const translated = hindiJson.goals[goal.id as keyof typeof hindiJson.goals];
    return { ...goal, label: translated.label, blurb: translated.blurb };
  });
}

export function courseCopy(course: Course, language: SiteLanguage) {
  const extra = language === "hi" ? hindiJson.courses[course.slug as keyof typeof hindiJson.courses] : null;
  return {
    name: extra?.name ?? course.name,
    summary: extra?.summary ?? course.summary,
    about: extra?.about ?? [...course.about],
    eligibility: language === "hi" ? course.eligibilityHi : course.eligibility,
    includes: extra?.includes ?? [...course.includes],
    duration: extra?.duration ?? course.duration,
    fees: course.fees.map((fee) => ({
      ...fee,
      label: extra?.fees[fee.label as keyof typeof extra.fees] ?? fee.label,
    })),
    batches: course.batches.map((batch) => ({
      ...batch,
      label: language === "hi" ? batchHi[batch.id as BatchId] : batch.label,
      days: language === "hi" ? (dayHi[batch.days] ?? batch.days) : batch.days,
    })),
  };
}

export function facultyCopy(language: SiteLanguage) {
  return academy.faculty.map((person) => {
    if (language === "en") return person;
    const translated = hindiJson.faculty[person.id as keyof typeof hindiJson.faculty];
    return { ...person, name: translated.name, role: translated.role, bio: translated.bio };
  });
}

export function courseBySlug(slug: string) {
  return getCourse(slug);
}
