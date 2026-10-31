import type { Metadata } from "next";
import { ContactView } from "@/components/contact-view";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  const copy = ui(language);
  return { title: copy.contactTitle, description: copy.metaContactDescription };
}

export default function ContactPage() {
  return <ContactView />;
}
