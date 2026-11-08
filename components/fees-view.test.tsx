/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { FeesView } from "@/components/fees-view";
import { academy, formatFeeRange } from "@/lib/academy";
import { courseCopy } from "@/lib/localize";

vi.mock("next/navigation", () => ({
  usePathname: () => "/fees",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(language: "en" | "hi") {
  act(() => root?.unmount());
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ThemeProvider>
        <LanguageProvider initial={language}>
          <FeesView />
        </LanguageProvider>
      </ThemeProvider>,
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function classTokens(element: Element | null | undefined): string[] {
  return (element?.className ?? "").split(/\s+/).filter(Boolean);
}

describe("fees comparison", () => {
  it.each(["en", "hi"] as const)("shows every fee and batch in a narrow list in %s", (language) => {
    mount(language);
    const narrow = host?.querySelector("ul");
    expect(narrow, "narrow comparison list").not.toBeNull();
    expect(classTokens(narrow)).toContain("min-[768px]:hidden");
    expect(classTokens(narrow)).not.toContain("min-w-[40rem]");
    expect(classTokens(narrow)).not.toContain("overflow-x-auto");
    expect(narrow?.closest("[class*='overflow-x-auto']")).toBeNull();

    const text = narrow?.textContent ?? "";
    for (const course of academy.courses) {
      const shown = courseCopy(course, language);
      expect(text, shown.name).toContain(shown.name);
      for (const fee of shown.fees) {
        expect(text, `${shown.name} ${fee.label}`).toContain(formatFeeRange(fee, language));
        if (shown.fees.length > 1) expect(text, fee.label).toContain(fee.label);
      }
      for (const batch of shown.batches) {
        expect(text, `${shown.name} ${batch.label}`).toContain(batch.label);
      }
    }

    const punjab = text;
    expect(punjab).not.toContain(language === "hi" ? "₹1,800–₹3,600 / महीना" : "₹1,800–₹3,600");
  });

  it("keeps the wide table for desktop, with column headers", () => {
    mount("en");
    const table = host?.querySelector("table");
    expect(table).not.toBeNull();
    expect(classTokens(table)).toContain("min-w-[40rem]");
    expect(classTokens(table?.parentElement)).toContain("hidden");
    expect(classTokens(table?.parentElement)).toContain("min-[768px]:block");
    expect(classTokens(table?.parentElement)).toContain("overflow-x-auto");
    const headers = [...(table?.querySelectorAll("th") ?? [])].map((cell) => cell.textContent);
    expect(headers).toEqual(["Course", "For", "Fee", "Batches"]);
    for (const header of table?.querySelectorAll("th") ?? []) {
      expect(header.getAttribute("scope")).toBe("col");
    }

    mount("hi");
    const hindi = host?.querySelector("table");
    expect([... (hindi?.querySelectorAll("th") ?? [])].map((cell) => cell.textContent)).toEqual([
      "कोर्स",
      "किसके लिए",
      "फ़ीस",
      "बैच",
    ]);
  });
});
