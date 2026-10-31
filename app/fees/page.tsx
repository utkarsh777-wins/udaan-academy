import type { Metadata } from "next";
import { FeesView } from "@/components/fees-view";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  const copy = ui(language);
  return { title: copy.feesTitle, description: copy.metaFeesDescription };
}

export default function FeesPage() {
  return <FeesView />;
}
