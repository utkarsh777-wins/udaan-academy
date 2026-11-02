"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { academy, coursesForGoal, formatFeeRange } from "@/lib/academy";
import { courseCopy, goalCopy, ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { cn } from "@/lib/utils";

export function CourseBrowser() {
  const params = useSearchParams();
  const language = useSiteLang();
  const copy = ui(language);
  const goals = goalCopy(language);
  const initial = params.get("goal") ?? "all";
  const known = academy.goals.some((goal) => goal.id === initial);
  const [goal, setGoal] = useState(known ? initial : "all");
  const courses = coursesForGoal(goal);
  const hi = language === "hi";

  return (
    <div>
      <div role="tablist" aria-label={copy.filterLabel} className="mb-7 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {goals.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={goal === item.id}
            onClick={() => {
              setGoal(item.id);
              const url = new URL(window.location.href);
              if (item.id === "all") url.searchParams.delete("goal");
              else url.searchParams.set("goal", item.id);
              window.history.replaceState(null, "", `${url.pathname}${url.search}`);
            }}
            className={cn(
              "h-[38px] shrink-0 rounded-full border px-4 text-[15px] font-medium",
              goal === item.id ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {courses.length === 0 ? (
        <p className="text-muted-foreground">{copy.noCourse}</p>
      ) : (
        <ul>
          {courses.map((course, index) => {
            const shown = courseCopy(course, language);
            const fee = shown.fees[0];
            const track = goals.find((item) => item.id === course.goal)?.label ?? course.goal;
            return (
              <li key={course.slug}>
                <Link
                  href={`/courses/${course.slug}`}
                  className={cn(
                    "grid items-center gap-3 border-b border-border py-7 lg:grid-cols-[200px_minmax(0,1fr)_220px_150px] lg:gap-7",
                    index === 0 && "border-t border-foreground",
                  )}
                >
                  <p className="eyebrow">{track}</p>
                  <div>
                    <h2 className="font-heading text-2xl font-bold group-hover:text-primary">{shown.name}</h2>
                    <p className="mt-1.5 text-[15.5px] text-muted-foreground">{shown.summary}</p>
                  </div>
                  <div>
                    <p className="num text-[14.5px]">{fee ? formatFeeRange(fee, language) : ""}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{shown.duration}</p>
                  </div>
                  <span className="inline-flex h-9 w-fit items-center rounded-[10px] border border-border px-3 text-sm font-semibold">
                    {hi ? "डिटेल" : "Details"} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
