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
    mount();
    const launcher = host?.querySelector("button") as HTMLButtonElement | null;
    act(() => {
      launcher?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("hidden");
    const close = host?.querySelector("button[aria-label='Close counsellor']") as HTMLButtonElement | null;
    act(() => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
  });
});
