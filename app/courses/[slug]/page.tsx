import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { academy, getCourse } from "@/lib/academy";
import { courseCopy, ui } from "@/lib/localize";
import { readSiteLanguage } from "@/lib/read-language";
import { CourseView } from "@/components/course-view";

export function generateStaticParams() {
  return academy.courses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const language = await readSiteLanguage();
  const { slug } = await params;
  const course = getCourse(slug);
  const copy = ui(language);
  if (!course) return { title: copy.metaCourseFallback };
  const shown = courseCopy(course, language);
  return { title: shown.name, description: shown.summary };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return <CourseView slug={slug} />;
}
