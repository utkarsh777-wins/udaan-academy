/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import { TrialForm } from "@/components/trial-form";

vi.mock("next/navigation", () => ({
  usePathname: () => "/contact",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  useSearchParams: () => ({ get: () => null }),
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <LanguageProvider initial="en">
        <TrialForm />
      </LanguageProvider>,
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("trial form accepts a one-word time name", () => {
  it.each([
    ["en", "Sham", "en"],
    ["en", "Subah", "en"],
    ["en", "Savera", "en"],
    ["en", "Sandhya", "en"],
    ["hi", "शाम", "hi"],
    ["en", "ਸ਼ਾਮ", "pa"],
  ] as const)("posts %s as %s without a confirm flag", async (site, student, spoken) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ booking: { id: "UA-FORM" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <LanguageProvider initial={site === "hi" ? "hi" : "en"}>
          <TrialForm />
        </LanguageProvider>,
      );
    });
    const view = host;
    if (!view) throw new Error("form host missing");
    const name = view.querySelector("input") as HTMLInputElement;
    const phone = view.querySelectorAll("input")[1] as HTMLInputElement;
    act(() => {
      setInput(name, student);
      setInput(phone, "9876543210");
      const dateButtons = [...view.querySelectorAll("button")].filter((button) => button.hasAttribute("aria-pressed") && button.hasAttribute("aria-label"));
      dateButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const select = view.querySelector("select") as HTMLSelectElement;
      const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      selectSetter?.call(select, spoken);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const submit = [...view.querySelectorAll("button")].find((button) => button.getAttribute("type") === "submit") as HTMLButtonElement;
    await act(async () => {
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as { name: string; language: string; nameConfirmed?: boolean };
    expect(body.name).toBe(student);
    expect(body.language).toBe(spoken);
    expect(body.nameConfirmed).toBeUndefined();
    expect(view.textContent).toContain("UA-FORM");
    vi.unstubAllGlobals();
  });
});

describe("trial form errors", () => {
  it("links the first invalid field and moves focus there", () => {
    mount();
    const form = host?.querySelector("form");
    const name = host?.querySelector("input") as HTMLInputElement | null;
    act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(name?.getAttribute("aria-invalid")).toBe("true");
    const describedBy = name?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(host?.querySelector(`[id="${describedBy}"]`)?.textContent).toMatch(/name/i);
    expect(document.activeElement).toBe(name);
  });
});

describe("trial form date chips and mobile review", () => {
  it("formats date chips as a 7-column calendar grid with weekday headers, placeholders, month headings, and aria-labels", () => {
    mount();
    const dateButtons = [...(host?.querySelectorAll("button") ?? [])].filter(
      (button) => button.hasAttribute("aria-pressed") && button.hasAttribute("aria-label"),
    );
    expect(dateButtons.length).toBeGreaterThan(0);
    // Inside the grid, each chip shows just the day number
    expect(dateButtons[0]?.textContent?.trim()).toMatch(/^\d{1,2}$/);
    // aria-label unchanged
    expect(dateButtons[0]?.getAttribute("aria-label")).toMatch(/^[A-Za-z]+,\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}$/);

    // grid has 7 columns
    const container = dateButtons[0]?.parentElement;
    expect(container?.className).toContain("grid-cols-7");

    // weekday headers row (7 columns Mon..Sun)
    const weekdayHeaders = [...(container?.querySelectorAll('[data-weekday-header="true"]') ?? [])];
    expect(weekdayHeaders).toHaveLength(7);
    expect(weekdayHeaders.map((h) => h.textContent?.trim())).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

    // placeholder cells for gaps
    const placeholders = container?.querySelectorAll('[data-placeholder="true"]');
    expect(placeholders?.length).toBeGreaterThan(0);

    // month heading at start and at month break
    const monthHeadings = [...(container?.querySelectorAll('[data-month-heading="true"]') ?? [])];
    expect(monthHeadings.length).toBeGreaterThanOrEqual(2);
    expect(monthHeadings[0]?.textContent?.trim()).toMatch(/^[A-Za-z]+\s+\d{4}$/);
    expect(monthHeadings[1]?.textContent?.trim()).toMatch(/^[A-Za-z]+\s+\d{4}$/);
    expect(monthHeadings[0]?.textContent).not.toBe(monthHeadings[1]?.textContent);
  });

  it("renders calendar grid with localized Hindi headers and month break heading", () => {
    act(() => root?.unmount());
    host?.remove();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <LanguageProvider initial="hi">
          <TrialForm />
        </LanguageProvider>,
      );
    });
    const grid = host?.querySelector(".grid-cols-7");
    expect(grid).toBeTruthy();
    const weekdayHeaders = [...(grid?.querySelectorAll('[data-weekday-header="true"]') ?? [])];
    expect(weekdayHeaders.map((h) => h.textContent?.trim())).toEqual(["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"]);
    const monthHeadings = [...(grid?.querySelectorAll('[data-month-heading="true"]') ?? [])];
    expect(monthHeadings.length).toBeGreaterThanOrEqual(2);
    expect(monthHeadings[0]?.textContent).toContain("2026");
    const dateButtons = [...(grid?.querySelectorAll("button") ?? [])].filter(
      (b) => b.hasAttribute("aria-pressed") && b.hasAttribute("aria-label"),
    );
    expect(dateButtons[0]?.getAttribute("aria-label")).toMatch(/^[^\d]+,\s+\d{1,2}\s+[^\d]+\s+\d{4}$/);
  });

  it("avoids mobile detail duplication between review card and trial pass card", async () => {
    mount();
    const view = host;
    if (!view) throw new Error("host missing");
    const aside = view.querySelector("aside");
    expect(aside?.className).not.toContain("hidden lg:block");

    const name = view.querySelector("input") as HTMLInputElement;
    const phone = view.querySelectorAll("input")[1] as HTMLInputElement;
    act(() => {
      setInput(name, "Harpreet");
      setInput(phone, "9876543210");
      const dateButtons = [...view.querySelectorAll("button")].filter(
        (b) => b.hasAttribute("aria-pressed") && b.hasAttribute("aria-label"),
      );
      dateButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const submit = [...view.querySelectorAll("button")].find(
      (button) => button.getAttribute("type") === "submit",
    );
    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // During review, pass aside is hidden on mobile
    expect(aside?.className).toContain("hidden lg:block");

    const reviewTicket = view.querySelector('form [role="group"]');
    expect(reviewTicket).toBeTruthy();
    const rows = [...(reviewTicket?.querySelectorAll("dl > div") ?? [])].map((div) => ({
      label: div.querySelector("dt")?.textContent?.trim(),
      value: div.querySelector("dd")?.textContent?.trim(),
      className: div.className,
    }));
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ label: "Name", value: "Harpreet" });
    expect(rows[1]).toMatchObject({ label: "Phone", value: "9876543210" });
    expect(rows[2]).toMatchObject({ label: "Course", value: "IELTS & PTE" });
    expect(rows[2].className).toContain("lg:hidden");
    expect(rows[3]).toMatchObject({ label: "Batch", value: "Morning" });
    expect(rows[3].className).toContain("lg:hidden");
    expect(rows[4].label).toBe("Date");
    expect(rows[4].value).toBeTruthy();
    expect(rows[4].value).not.toBe("—");
    expect(rows[4].className).not.toContain("hidden");
    expect(rows[5]).toMatchObject({ label: "Time", value: "7:00–9:00 am" });
    expect(rows[5].className).not.toContain("hidden");

    // Review card shows course once (in Course field, not in a route line)
    const reviewCourseMatches = reviewTicket?.textContent?.match(/IELTS & PTE/g) ?? [];
    expect(reviewCourseMatches).toHaveLength(1);
    expect(reviewTicket?.textContent).not.toContain("Phagwara");

    // The trial pass aside keeps its route line
    const asideTicket = view.querySelector('aside [role="group"]');
    expect(asideTicket?.textContent).toContain("Phagwara");
    const asideCourseMatches = asideTicket?.textContent?.match(/IELTS & PTE/g) ?? [];
    expect(asideCourseMatches.length).toBeGreaterThanOrEqual(2);
  });
});
