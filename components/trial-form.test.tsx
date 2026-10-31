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
