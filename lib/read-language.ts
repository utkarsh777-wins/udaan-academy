import { cookies } from "next/headers";
import { LANG_COOKIE, parseSiteLanguage, type SiteLanguage } from "@/lib/site-language";

export async function readSiteLanguage(): Promise<SiteLanguage> {
  const jar = await cookies();
  return parseSiteLanguage(jar.get(LANG_COOKIE)?.value);
}
