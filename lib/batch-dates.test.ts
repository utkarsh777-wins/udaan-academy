import { describe, expect, it } from "vitest";
import { formatDateChip, formatDateChipAria, todayISO } from "@/lib/dates";
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

  it("maps late-night IST instants (e.g. 23:30 IST / 18:00 UTC) to the correct IST calendar date", () => {
    // 18:00 UTC on 2026-10-31 is 23:30 IST on 2026-10-31 (Saturday)
    const lateNight = new Date("2026-10-31T18:00:00.000Z");
    expect(todayISO(lateNight)).toBe("2026-10-31");

    // At 23:30 IST on Saturday, Saturday's 7:00–9:00 am batch has already ended.
    // Weekday batches ([1..5]) start on Monday 2026-11-02.
    const weekdayDates = bookableDates([1, 2, 3, 4, 5], "7:00–9:00 am", lateNight);
    expect(weekdayDates[0]).toBe("2026-11-02");

    // Weekend batches ([6, 0]) offer Sunday 2026-11-01 as the first slot.
    const weekendDates = bookableDates([6, 0], "7:00–9:00 am", lateNight);
    expect(weekendDates[0]).toBe("2026-11-01");
  });
});

describe("date chips formatting", () => {
  it("formats date chips and aria labels across en, hi, and pa", () => {
    const iso = "2026-11-09"; // Monday
    // English
    expect(formatDateChip(iso, "en")).toBe("Mon, 9 Nov");
    expect(formatDateChipAria(iso, "en")).toBe("Mon, 9 Nov 2026");

    // Hindi (short weekday, full month name)
    expect(formatDateChip(iso, "hi")).toBe("सोम, 9 नवंबर");
    expect(formatDateChipAria(iso, "hi")).toBe("सोम, 9 नवंबर 2026");

    // Punjabi
    expect(formatDateChip(iso, "pa")).toBe("ਸੋਮ, 9 ਨਵੰਬਰ");
    expect(formatDateChipAria(iso, "pa")).toBe("ਸੋਮ, 9 ਨਵੰਬਰ 2026");
  });

  it("formats year-boundary dates (31 Dec -> 1 Jan) with chip text and aria-label year", () => {
    const dec31 = "2026-12-31"; // Thursday
    const jan01 = "2027-01-01"; // Friday

    // 31 Dec
    expect(formatDateChip(dec31, "en")).toBe("Thu, 31 Dec");
    expect(formatDateChipAria(dec31, "en")).toBe("Thu, 31 Dec 2026");
    expect(formatDateChip(dec31, "hi")).toBe("गुरु, 31 दिसंबर");
    expect(formatDateChipAria(dec31, "hi")).toBe("गुरु, 31 दिसंबर 2026");
    expect(formatDateChip(dec31, "pa")).toBe("ਵੀਰ, 31 ਦਸੰਬਰ");
    expect(formatDateChipAria(dec31, "pa")).toBe("ਵੀਰ, 31 ਦਸੰਬਰ 2026");

    // 1 Jan
    expect(formatDateChip(jan01, "en")).toBe("Fri, 1 Jan");
    expect(formatDateChipAria(jan01, "en")).toBe("Fri, 1 Jan 2027");
    expect(formatDateChip(jan01, "hi")).toBe("शुक्र, 1 जनवरी");
    expect(formatDateChipAria(jan01, "hi")).toBe("शुक्र, 1 जनवरी 2027");
    expect(formatDateChip(jan01, "pa")).toBe("ਸ਼ੁੱਕਰ, 1 ਜਨਵਰੀ");
    expect(formatDateChipAria(jan01, "pa")).toBe("ਸ਼ੁੱਕਰ, 1 ਜਨਵਰੀ 2027");
  });
});
