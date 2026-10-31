"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { ui } from "@/lib/localize";
import { useSetSiteLang, useSiteLang } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ className }: { className?: string }) {
  const language = useSiteLang();
  const setLanguage = useSetSiteLang();
  const copy = ui(language);

  return (
    <div className={cn("inline-flex rounded-full border border-border bg-card p-[3px]", className)} role="group" aria-label={copy.langLabel}>
      <button
        type="button"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
        className={cn(
          "inline-flex h-[30px] min-w-10 items-center justify-center rounded-full px-2.5 text-sm font-semibold",
          language === "en" ? "bg-foreground text-background" : "text-muted-foreground",
        )}
      >
        EN
      </button>
      <button
        type="button"
        lang="hi"
        aria-pressed={language === "hi"}
        onClick={() => setLanguage("hi")}
        className={cn(
          "inline-flex h-[30px] min-w-10 items-center justify-center rounded-full px-2.5 text-sm font-semibold",
          language === "hi" ? "bg-foreground text-background" : "text-muted-foreground",
        )}
      >
        हिं
      </button>
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const language = useSiteLang();
  const copy = ui(language);
  const dark = resolvedTheme === "dark";
  const next = dark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 rounded-full border-border bg-card text-foreground hover:bg-muted"
      aria-label={dark ? copy.themeToLight : copy.themeToDark}
      onClick={() => setTheme(next)}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
