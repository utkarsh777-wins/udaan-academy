"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { siteLanguageCookie, type SiteLanguage } from "@/lib/site-language";

const LanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
}>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({
  initial,
  children,
}: {
  initial: SiteLanguage;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<SiteLanguage>(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setLanguageState(initial);
  }

  function setLanguage(next: SiteLanguage) {
    setLanguageState(next);
    document.cookie = siteLanguageCookie(next);
    document.documentElement.lang = next;
    router.refresh();
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useSiteLang(): SiteLanguage {
  return useContext(LanguageContext).language;
}

export function useSetSiteLang(): (language: SiteLanguage) => void {
  return useContext(LanguageContext).setLanguage;
}
