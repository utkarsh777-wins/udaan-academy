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
  it("formats date chips with weekday, month, and full date aria-label in English and Hindi", () => {
    mount();
    const dateButtons = [...(host?.querySelectorAll("button") ?? [])].filter(
      (button) => button.hasAttribute("aria-pressed") && button.hasAttribute("aria-label"),
    );
    expect(dateButtons.length).toBeGreaterThan(0);
    expect(dateButtons[0]?.textContent).toMatch(/^[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}$/);
    expect(dateButtons[0]?.getAttribute("aria-label")).toMatch(/^[A-Za-z]+,\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}$/);
    const container = dateButtons[0]?.parentElement;
    expect(container?.className).toContain("flex-wrap");
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
  });
});
