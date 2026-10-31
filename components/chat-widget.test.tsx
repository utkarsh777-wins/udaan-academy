/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import { ChatWidget } from "@/components/chat-widget";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
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
        <ChatWidget />
      </LanguageProvider>,
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollTo = () => undefined;
  window.scrollTo = () => undefined;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("chat launcher focus", () => {
  it("returns focus to the launcher after close", () => {
    mount();
    const launcher = host?.querySelector("button[aria-haspopup='dialog']") as HTMLButtonElement | null;
    expect(launcher).toBeTruthy();
    act(() => {
      launcher?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const close = host?.querySelector("button[aria-label='Close counsellor']") as HTMLButtonElement | null;
    expect(close).toBeTruthy();
    act(() => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const returned = host?.querySelector("button[aria-haspopup='dialog']");
    expect(returned).toBeTruthy();
    expect(document.activeElement).toBe(returned);

    act(() => {
      (returned as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(host?.querySelector("button[aria-haspopup='dialog']"));
  });

  it("locks body scroll on a narrow screen while the chat is open", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 80 });
    window.scrollTo = () => undefined;
    mount();
    const launcher = host?.querySelector("button") as HTMLButtonElement | null;
    act(() => {
      launcher?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-80px");
    expect(document.body.style.overflow).toBe("hidden");
    const close = host?.querySelector("button[aria-label='Close counsellor']") as HTMLButtonElement | null;
    act(() => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.position).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores a second click on Send request", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            reply: "Check this.",
            draft: {
              confirming: true,
              active: true,
              name: "Aman",
              phone: "9876543210",
              course: "ielts-pte",
              batch: "morning",
              date: "2026-11-20",
            },
          }),
        };
      }),
    );
    mount();
    act(() => {
      host?.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const input = host?.querySelector("#counsellor-message") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "book");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      host?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const sendRequest = [...(host?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.includes("Send request"));
    expect(sendRequest).toBeTruthy();
    calls = 0;
    await act(async () => {
      sendRequest?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sendRequest?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(calls).toBe(1);
    expect([...(host?.querySelectorAll("p") ?? [])].filter((node) => node.textContent === "Send request")).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
