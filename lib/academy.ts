import academyJson from "@/content/academy.json";

export type BatchId = "morning" | "evening" | "weekend";
export type Language = "en" | "hi" | "pa";

export type Course = (typeof academyJson.courses)[number];
export type Academy = typeof academyJson;

export const academy = academyJson;

export function getCourse(slug: string): Course | undefined {
  return academy.courses.find((course) => course.slug === slug);
}

export function coursesForGoal(goal: string): Course[] {
  if (goal === "all") return academy.courses;
  return academy.courses.filter((course) => course.goal === goal);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFeeRange(
  fee: { min: number; max: number; period: string },
  language: "en" | "hi" = "en",
): string {
  const range = `${formatInr(fee.min)}–${formatInr(fee.max)}`;
  if (fee.period === "package") return range;
  return language === "hi" ? `${range} / महीना` : `${range} / month`;
}

export function courseFeeSummary(course: Course, language: "en" | "hi" = "en"): string {
  return course.fees
    .map((fee) => {
      const label =
        language === "hi"
          ? fee.label === "Full package"
            ? "पूरा पैकेज"
            : fee.label === "Monthly"
              ? "महीने की"
              : fee.label === "Classes 9–10"
                ? "क्लास 9–10"
                : fee.label === "Classes 11–12"
                  ? "क्लास 11–12"
                  : fee.label
          : fee.label;
      return `${label}: ${formatFeeRange(fee, language)}`;
    })
    .join("; ");
}

const BATCH_LABEL: Record<Language, Record<BatchId, string>> = {
  en: { morning: "morning", evening: "evening", weekend: "weekend" },
  hi: { morning: "सुबह", evening: "शाम", weekend: "वीकेंड" },
  pa: { morning: "ਸਵੇਰ", evening: "ਸ਼ਾਮ", weekend: "ਵੀਕਐਂਡ" },
};

export function batchLabel(id: BatchId, language: Language): string {
  return BATCH_LABEL[language][id];
}
