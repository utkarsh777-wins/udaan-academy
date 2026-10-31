import { Suspense } from "react";
import type { Metadata } from "next";
import { CourseBrowser } from "@/components/course-browser";
import { CoursesIntro } from "@/components/courses-intro";
import { ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const language = await readSiteLanguage();
  const copy = ui(language);
  return { title: copy.coursesTitle, description: copy.metaCoursesDescription };
}

export default function CoursesPage() {
  return (
    <main id="main">
      <CoursesIntro />
      <div className="mx-auto max-w-[1240px] px-5 py-9 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <CourseBrowser />
        </Suspense>
      </div>
    </main>
  );
}
