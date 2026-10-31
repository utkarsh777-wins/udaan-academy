"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { ui } from "@/lib/localize";
import { useSetSiteLang, useSiteLang } from "@/components/language-provider";
import { LanguageSwitch } from "@/components/preferences";
import { LogoMark } from "@/components/marks";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const language = useSiteLang();
  const setLanguage = useSetSiteLang();
  const copy = ui(language);
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dark = resolvedTheme === "dark";
  const links = [
    { href: "/courses", label: copy.navCourses },
    { href: "/faculty", label: copy.navFaculty },
    { href: "/fees", label: copy.navFees },
    { href: "/contact", label: language === "hi" ? "पता" : "Visit" },
  ];

  return (
    <>
      <div role="note" className="border-b border-border bg-notice px-4 py-1.5 text-center text-[13px] leading-snug text-muted-foreground">
        {copy.notice}
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-background/94">
        <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-3 px-5 min-[768px]:h-[68px] min-[768px]:px-8 min-[1920px]:max-w-[1360px]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark />
            <span>
              <span className="block font-heading text-[21px] leading-none font-extrabold tracking-tight">
                {language === "hi" ? "उड़ान" : "Udaan"}
              </span>
              <small className="mt-0.5 hidden text-xs font-medium text-muted-foreground min-[360px]:block">
                {language === "hi" ? "अकादमी · जी.टी. रोड, फगवाड़ा" : "Academy · GT Road, Phagwara"}
              </small>
            </span>
          </Link>
          <nav className="ml-3 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {links.map((link) => {
              const current = link.href === "/contact" ? pathname === "/contact" : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-2 text-[15.5px] font-medium text-muted-foreground",
                    current && "text-foreground",
                  )}
                >
                  {link.label}
                  {current ? <span className="absolute right-3 -bottom-[22px] left-3 h-0.5 bg-primary" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <LanguageSwitch />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden size-10 rounded-full border-border bg-card lg:inline-flex"
              aria-label={dark ? copy.themeToLight : copy.themeToDark}
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button nativeButton={false} render={<Link href="/contact" />} className="hidden h-11 bg-primary px-4 text-primary-foreground hover:bg-primary-hover lg:inline-flex">
              {language === "hi" ? "फ़्री ट्रायल बुक करें" : "Book free trial"}
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="size-10 rounded-full lg:hidden" aria-label={copy.openMenu} />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="top" className="inset-0 h-dvh w-full max-w-none rounded-none border-0 bg-background p-0">
                <div className="flex h-[60px] items-center px-5">
                  <LogoMark />
                  <SheetTitle className="ml-2 font-heading text-[21px] font-extrabold">{language === "hi" ? "उड़ान" : "Udaan"}</SheetTitle>
                  <SheetClose
                    render={<Button variant="outline" size="icon" className="ml-auto size-10 rounded-full" aria-label={language === "hi" ? "मेनू बंद करें" : "Close menu"} />}
                  >
                    <XIcon />
                  </SheetClose>
                </div>
                <nav className="flex flex-col px-5">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="border-b border-border py-4 font-heading text-[26px]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-6 flex items-center justify-between px-5">
                  <span className="font-medium">{language === "hi" ? "थीम" : "Theme"}</span>
                  <div className="inline-flex rounded-full border border-border p-[3px]">
                    <button type="button" className={cn("h-8 rounded-full px-3 text-sm", !dark && "bg-foreground text-background")} onClick={() => setTheme("light")}>
                      {language === "hi" ? "लाइट" : "Light"}
                    </button>
                    <button type="button" className={cn("h-8 rounded-full px-3 text-sm", dark && "bg-foreground text-background")} onClick={() => setTheme("dark")}>
                      {language === "hi" ? "डार्क" : "Dark"}
                    </button>
                  </div>
                </div>
                <div className="mt-6 px-5">
                  <p className="mb-2 text-sm text-muted-foreground">{copy.langLabel}</p>
                  <div className="flex gap-2">
                    <button type="button" className={cn("h-10 rounded-full px-4", language === "en" && "bg-foreground text-background")} onClick={() => setLanguage("en")}>EN</button>
                    <button type="button" lang="hi" className={cn("h-10 rounded-full px-4", language === "hi" && "bg-foreground text-background")} onClick={() => setLanguage("hi")}>हिं</button>
                  </div>
                </div>
                <div className="absolute inset-x-5 bottom-6">
                  <Button nativeButton={false} render={<Link href="/contact" />} className="h-[52px] w-full bg-primary text-primary-foreground hover:bg-primary-hover" onClick={() => setOpen(false)}>
                    {language === "hi" ? "फ़्री ट्रायल बुक करें" : "Book free trial"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
