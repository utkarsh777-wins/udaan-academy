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
      const dateButtons = [...view.querySelectorAll("button")].filter((button) => /^\d{2}$/.test(button.textContent ?? ""));
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
