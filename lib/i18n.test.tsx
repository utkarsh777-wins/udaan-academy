/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider, useSetSiteLang } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageSwitch, ThemeToggle } from "@/components/preferences";
import { SiteHeader } from "@/components/site-header";
import { HomeView } from "@/components/home-view";
import { CoursesIntro } from "@/components/courses-intro";
import { CourseView } from "@/components/course-view";
import { FacultyView } from "@/components/faculty-view";
import { FeesView } from "@/components/fees-view";
import { ContactView } from "@/components/contact-view";
import { BookingsClosed, BookingsIntro } from "@/components/bookings-view";
import { themeConfig } from "@/lib/theme";
import { siteLanguageCookie } from "@/lib/site-language";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(node);
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
  document.cookie = "udaan-lang=; Path=/; Max-Age=0";
  localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function page(node: React.ReactNode, language: "en" | "hi" = "hi") {
  return (
    <ThemeProvider>
      <LanguageProvider initial={language}>{node}</LanguageProvider>
    </ThemeProvider>
  );
}

describe("site language", () => {
  it("renders Hindi copy on every page route", () => {
    const checks: Array<[string, () => React.ReactNode, string]> = [
      ["home", () => <HomeView />, "सामने वाली परीक्षा"],
      ["courses", () => <CoursesIntro />, "पाँच कोर्स"],
      ["course", () => <CourseView slug="ielts-pte" />, "मॉक टेस्ट"],
      ["faculty", () => <FacultyView />, "कौन क्या पढ़ाता है"],
      ["fees", () => <FeesView />, "पूछने से पहले फ़ीस"],
      ["contact", () => <ContactView />, "एक क्लास बुक करें"],
      ["bookings", () => (<><BookingsIntro /><BookingsClosed /></>), "यह पेज तब तक बंद रहता है"],
    ];
    for (const [name, node, hindi] of checks) {
      mount(page(node(), "hi"));
      expect(host?.textContent, name).toContain(hindi);
      expect(host?.textContent, name).not.toContain("Sample site — a fictional");
      act(() => root?.unmount());
      host?.remove();
      root = null;
      host = null;
    }
  });

  it("persists the language choice in a cookie", () => {
    function Switcher() {
      const setLanguage = useSetSiteLang();
      return (
        <button type="button" onClick={() => setLanguage("hi")}>
          हिं
        </button>
      );
    }
    mount(
      page(
        <>
          <Switcher />
          <HomeView />
        </>,
        "en",
      ),
    );
    const button = host?.querySelector("button");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.cookie).toContain("udaan-lang=hi");
    expect(siteLanguageCookie("hi")).toContain("SameSite=Lax");
    expect(document.documentElement.lang).toBe("hi");
    expect(host?.textContent).toContain("सामने वाली परीक्षा");
  });
});

describe("sample notice", () => {
  it("is the only visible sample label", () => {
    for (const language of ["en", "hi"] as const) {
      mount(
        page(
          <>
            <SiteHeader />
            <HomeView />
            <CoursesIntro />
            <FacultyView />
            <FeesView />
            <ContactView />
          </>,
          language,
        ),
      );
      const notice = host?.querySelector("[role=note]")?.textContent ?? "";
      const rest = (host?.textContent ?? "").replace(notice, "");
      expect(rest.toLowerCase()).not.toContain("sample");
      expect(rest).not.toContain("नमूना");
      expect(notice.toLowerCase()).toMatch(/sample|सैंपल/);
      act(() => root?.unmount());
      host?.remove();
      root = null;
      host = null;
    }
  });
});

describe("theme toggle", () => {
  it("exists and persists the choice", () => {
    expect(themeConfig.attribute).toBe("class");
    expect(themeConfig.defaultTheme).toBe("system");
    expect(themeConfig.enableSystem).toBe(true);
    mount(
      page(
        <>
          <ThemeToggle />
          <LanguageSwitch />
        </>,
        "en",
      ),
    );
    const toggle = host?.querySelector("button[aria-label='Switch to dark theme']");
    expect(toggle).toBeTruthy();
    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(localStorage.getItem(themeConfig.storageKey)).toBe("dark");
  });
});
