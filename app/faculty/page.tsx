import type { Metadata } from "next";
import { FacultyView } from "@/components/faculty-view";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  const copy = ui(language);
  return { title: copy.facultyTitle, description: copy.metaFacultyDescription };
}

export default function FacultyPage() {
  return <FacultyView />;
}
