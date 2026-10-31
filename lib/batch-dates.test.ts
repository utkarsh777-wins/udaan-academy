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
