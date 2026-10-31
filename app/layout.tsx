import type { Metadata } from "next";
import { academy } from "@/lib/academy";
import { ui } from "@/lib/localize";
import { fontVariables } from "@/lib/fonts";
import { readSiteLanguage } from "@/lib/read-language";
import { getSiteUrl } from "@/lib/site-url";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatWidget } from "@/components/chat-widget";
import "./globals.css";

const siteUrl = getSiteUrl();

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  const copy = ui(language);
  return {
    metadataBase: new URL(siteUrl ?? "https://example.invalid"),
    title: {
      default: copy.metaHomeTitle,
      template: `%s · ${language === "hi" ? academy.nameHindi : academy.name}`,
    },
    description: copy.metaHomeDescription,
    applicationName: language === "hi" ? academy.nameHindi : academy.name,
    openGraph: {
      title: copy.metaHomeTitle,
      description: copy.metaHomeDescription,
      siteName: language === "hi" ? academy.nameHindi : academy.name,
      locale: language === "hi" ? "hi_IN" : "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metaHomeTitle,
      description: copy.metaHomeDescription,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await readSiteLanguage();
  const copy = ui(language);

  return (
    <html
      lang={language}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <LanguageProvider initial={language}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
            >
              {copy.skip}
            </a>
            <SiteHeader />
            <div className="flex-1 pb-24 md:pb-0">{children}</div>
            <SiteFooter />
            <ChatWidget />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
