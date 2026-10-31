"use client";

import { Suspense } from "react";
import { ui } from "@/lib/localize";
import { useSiteLang } from "@/components/language-provider";
import { TrialForm } from "@/components/trial-form";
import { Skeleton } from "@/components/ui/skeleton";

export function ContactView() {
  const language = useSiteLang();
  const copy = ui(language);
  const hi = language === "hi";

  return (
    <main id="main" className="ruled">
      <div className="mx-auto max-w-[1240px] px-5 py-14 min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
        <p className="eyebrow">{hi ? "फ़्री ट्रायल क्लास" : "Free trial class"}</p>
        <h1 className="mt-3 max-w-[16ch] font-heading text-[clamp(32px,4.2vw,50px)] font-bold">
          {hi ? "एक क्लास बुक करें। कुछ न दें।" : "Book one class. Pay nothing."}
        </h1>
        <p className="lead mt-3 max-w-[58ch] text-[19px] text-muted-foreground">
          {hi
            ? "जो बैच चुनेंगे, उसमें सीट रखी जाएगी। डेस्क फ़ोन करके पक्का करेगा। तब तक कुछ बुक नहीं होता।"
            : "We hold a seat in the batch you pick. The front desk calls to confirm; nothing is booked until they do."}
        </p>
        <div className="mt-10">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <TrialForm />
          </Suspense>
        </div>
        <p className="sr-only">{copy.contactTitle}</p>
      </div>
    </main>
  );
}
