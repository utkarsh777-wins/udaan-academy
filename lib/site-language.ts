export const LANG_COOKIE = "udaan-lang";
export type SiteLanguage = "en" | "hi";

export function parseSiteLanguage(value: string | undefined | null): SiteLanguage {
  return value === "hi" ? "hi" : "en";
}

export function siteLanguageCookie(language: SiteLanguage): string {
  return `${LANG_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function publicPhone(phone: string): string {
  return phone.replace(/\s*\(sample\)\s*/gi, "").trim();
}
