import { describe, expect, it } from "vitest";
import { bookableDates, weekdayIndex } from "@/lib/schedule";

describe("bookable dates", () => {
  it("only includes the batch weekdays inside the next 45 days", () => {
    const now = new Date("2026-10-31T08:00:00.000Z");
    const dates = bookableDates([1, 2, 3, 4, 5], "7:00–9:00 am", now);
    expect(dates).toContain("2026-11-02");
    expect(dates).not.toContain("2026-11-01");
    expect(dates.every((date) => [1, 2, 3, 4, 5].includes(weekdayIndex(date)))).toBe(true);
    expect(dates.at(-1)! <= "2026-12-15").toBe(true);
  });
});

import { formatDateChip, formatFullDate } from "@/lib/dates";

describe("date chips formatting", () => {
  it("formats date chips and full date aria labels across en, hi, and pa", () => {
    const iso = "2026-11-09"; // Monday
    // English
    expect(formatDateChip(iso, "en")).toBe("Mon, 9 Nov");
    expect(formatFullDate(iso, "en")).toBe("Monday, 9 November 2026");

    // Hindi
    expect(formatDateChip(iso, "hi")).toContain("सोम");
    expect(formatDateChip(iso, "hi")).toContain("9");
    expect(formatFullDate(iso, "hi")).toBe("सोमवार, 9 नवंबर 2026");

    // Punjabi
    expect(formatDateChip(iso, "pa")).toBe("ਸੋਮ, 9 ਨਵੰਬਰ");
    expect(formatFullDate(iso, "pa")).toBe("ਸੋਮਵਾਰ, 9 ਨਵੰਬਰ 2026");
  });
});
