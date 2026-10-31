"use client";

import Link from "next/link";
import { ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const copy = ui(useSiteLang());
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">{copy.notFoundTitle}</h1>
      <p className="max-w-xl text-muted-foreground">{copy.notFoundBody}</p>
      <Button nativeButton={false} render={<Link href="/courses" />} className="min-h-11 w-fit">
        {copy.notFoundCta}
      </Button>
    </main>
  );
}
