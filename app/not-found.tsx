import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  return { title: ui(language).notFoundTitle };
}

export default function NotFound() {
  return <NotFoundView />;
}
