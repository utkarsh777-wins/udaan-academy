"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleIcon, SendIcon, XIcon } from "lucide-react";
import { batchLabel, getCourse, type Language } from "@/lib/academy";
import { formatBatchTime, openingGreeting, languageSwitched, type Draft } from "@/lib/chat/respond";
import { courseCopy } from "@/lib/localize";
import { formatLongDate } from "@/lib/dates";
import { useSiteLang } from "@/components/language-provider";
import { setChatOpen } from "@/components/chat-state";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string; language: Language };

const quick: Record<Language, string[]> = {
  en: ["IELTS fees", "JEE batches", "Book a trial"],
  hi: ["IELTS फ़ीस", "JEE बैच", "ट्रायल बुक करें"],
  pa: ["IELTS ਫੀਸ", "JEE ਬੈਚ", "ਟਰਾਇਲ ਬੁੱਕ ਕਰੋ"],
};

const labels: Record<Language, { title: string; subtitle: string; send: string; placeholder: string; close: string; launcher: string }> = {
  en: {
    title: "Counsellor",
    subtitle: "Replies instantly · staff confirm bookings",
    send: "Send",
    placeholder: "Type a message",
    close: "Close counsellor",
    launcher: "Ask a counsellor",
  },
  hi: {
    title: "काउंसलर",
    subtitle: "तुरंत जवाब · बुकिंग डेस्क पक्की करता है",
    send: "भेजें",
    placeholder: "मैसेज लिखिए",
    close: "काउंसलर बंद करें",
    launcher: "काउंसलर से पूछें",
  },
  pa: {
    title: "ਕਾਉਂਸਲਰ",
    subtitle: "ਝਟਪਟ ਜਵਾਬ · ਬੁਕਿੰਗ ਡੈਸਕ ਪੱਕੀ ਕਰਦਾ ਹੈ",
    send: "ਭੇਜੋ",
    placeholder: "ਸੁਨੇਹਾ ਲਿਖੋ",
    close: "ਕਾਉਂਸਲਰ ਬੰਦ ਕਰੋ",
    launcher: "ਕਾਉਂਸਲਰ ਨੂੰ ਪੁੱਛੋ",
  },
};

function dayStamp(language: Language): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const label = language === "hi" ? "आज" : language === "pa" ? "ਅੱਜ" : "TODAY";
  return `${label} ${time}`;
}

export function ChatWidget() {
  const pathname = usePathname();
  const siteLanguage = useSiteLang();
  const initialChat: Language = siteLanguage === "hi" ? "hi" : "en";
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(initialChat);
  const [picked, setPicked] = useState(false);
  const [seenSite, setSeenSite] = useState(siteLanguage);
  const [draft, setDraft] = useState<Draft>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: openingGreeting(initialChat), language: initialChat },
  ]);

  if (!picked && seenSite !== siteLanguage) {
    const next: Language = siteLanguage === "hi" ? "hi" : "en";
    setSeenSite(siteLanguage);
    setLanguage(next);
    setMessages([{ role: "assistant", content: openingGreeting(next), language: next }]);
    setDraft({});
  }
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const sendingRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatOpen(open);
    return () => setChatOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia?.("(max-width: 767px)");
    if (!media?.matches) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    };
  }, [open]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, open, pending]);

  useEffect(() => {
    if (chipsRef.current) chipsRef.current.scrollLeft = 0;
  }, [language, open]);

  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    launcherRef.current?.focus();
  }, [open]);

  function closeChat() {
    restoreFocus.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeChat();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function switchLanguage(next: Language) {
    if (next === language) return;
    setPicked(true);
    setLanguage(next);
    setMessages((current) => {
      if (current.length <= 1) {
        return [{ role: "assistant", content: openingGreeting(next), language: next }];
      }
      return [...current, { role: "assistant", content: languageSwitched(next), language: next }];
    });
  }

  async function send(text: string, display?: string) {
    const message = text.trim();
    if (!message || pending || sendingRef.current) return;
    sendingRef.current = true;
    setPending(true);
    setError("");
    setInput("");
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: display ?? message, language }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, language, draft, history }),
      });
      const body = (await response.json()) as {
        reply?: string;
        draft?: Draft;
        error?: string;
      };
      if (response.status === 429 && body.reply) {
        setDraft(body.draft ?? draft);
        setMessages((current) => [...current, { role: "assistant", content: body.reply ?? "", language }]);
        return;
      }
      if (!response.ok || !body.reply) {
        setError(
          language === "hi"
            ? "अभी जवाब नहीं बन पाया। संपर्क पेज से फ़्री ट्रायल क्लास लिख सकते हैं।"
            : language === "pa"
              ? "ਹੁਣੇ ਜਵਾਬ ਨਹੀਂ ਬਣਿਆ। ਸੰਪਰਕ ਪੰਨੇ ਤੋਂ ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਲਿਖ ਸਕਦੇ ਹੋ।"
              : "The counsellor couldn’t reply just now. You can still book a free trial class on the contact page.",
        );
        return;
      }
      setDraft(body.draft ?? {});
      setMessages((current) => [...current, { role: "assistant", content: body.reply ?? "", language }]);
    } catch {
      setError(
        language === "hi"
          ? "कनेक्शन नहीं बना। थोड़ी देर बाद फिर लिखिए।"
          : language === "pa"
            ? "ਕਨੈਕਸ਼ਨ ਨਹੀਂ ਬਣਿਆ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਲਿਖੋ।"
            : "The connection dropped. Try again in a moment.",
      );
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  const copy = labels[language];
  const confirming = Boolean(draft.confirming && draft.course && draft.batch && draft.date);
  const renamePending = Boolean(draft.pendingName);
  const booked = draft.course ? getCourse(draft.course) : undefined;
  const bookedView = booked ? courseCopy(booked, language === "pa" ? "en" : language) : null;
  const courseName = booked ? (language === "pa" ? booked.namePa : bookedView?.name ?? booked.name) : "";
  const bookedBatch = bookedView?.batches.find((item) => item.id === draft.batch);

  if (pathname === "/contact") return null;

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={cn(
            "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-lg",
            "inset-0",
            "md:inset-auto md:right-6 md:bottom-6 md:h-[min(640px,calc(100dvh-48px))] md:w-[400px] md:rounded-[20px] md:border md:border-border",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
              <MessageCircleIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold">{copy.title}</h2>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" />
                {copy.subtitle}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-full"
              onClick={closeChat}
              aria-label={copy.close}
            >
              <XIcon />
            </Button>
          </div>
          <div className="flex gap-1.5 px-4 py-3" role="group" aria-label={language === "hi" ? "भाषा" : language === "pa" ? "ਭਾਸ਼ਾ" : "Language"}>
            {(
              [
                ["en", "English"],
                ["hi", "हिंदी"],
                ["pa", "ਪੰਜਾਬੀ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                lang={value}
                aria-pressed={language === value}
                onClick={() => switchLanguage(value)}
                className={cn(
                  "h-[30px] rounded-full border px-3 text-sm",
                  language === value ? "border-transparent bg-accent text-accent-foreground" : "border-border",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div ref={scrollerRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4" aria-live="polite">
            <p className="num text-center text-[12px] text-muted-foreground">{dayStamp(language)}</p>
            {messages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                lang={message.language === "en" ? "en" : message.language === "hi" ? "hi" : "pa"}
                className={cn(
                  "max-w-[84%] px-3 py-2 text-[15px] leading-normal",
                  message.language === "en" ? "leading-normal" : "leading-[1.75]",
                  message.role === "user"
                    ? "ml-auto rounded-2xl rounded-br-[6px] bg-primary text-primary-foreground"
                    : "rounded-2xl rounded-bl-[6px] bg-muted text-foreground",
                )}
              >
                <MessageText content={message.content} />
              </p>
            ))}
            {pending ? <p className="text-sm text-muted-foreground">…</p> : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          {confirming && bookedView && bookedBatch ? (
            <div className="px-4 pb-3">
              <p className="mb-2 text-sm text-muted-foreground">
                {language === "hi"
                  ? "भेजने से पहले चेक कर लीजिए।"
                  : language === "pa"
                    ? "ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਵੇਖ ਲਵੋ।"
                    : "Check this before it goes to the front desk."}
              </p>
              <Ticket
                label={language === "hi" ? "ट्रायल क्लास की डिटेल" : language === "pa" ? "ਟਰਾਇਲ ਕਲਾਸ ਦਾ ਵੇਰਵਾ" : "Trial class details"}
                eyebrow={language === "hi" ? "फ़्री ट्रायल क्लास" : language === "pa" ? "ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ" : "Free trial class"}
                from={language === "hi" ? "फगवाड़ा" : language === "pa" ? "ਫਗਵਾੜਾ" : "Phagwara"}
                to={courseName}
                fields={[
                  { label: language === "hi" ? "नाम" : language === "pa" ? "ਨਾਮ" : "Name", value: draft.name ?? "" },
                  { label: language === "hi" ? "फ़ोन" : language === "pa" ? "ਫੋਨ" : "Phone", value: draft.phone ?? "", mono: true },
                  { label: language === "hi" ? "कोर्स" : language === "pa" ? "ਕੋਰਸ" : "Course", value: courseName },
                  {
                    label: language === "hi" ? "बैच" : language === "pa" ? "ਬੈਚ" : "Batch",
                    value: draft.batch ? (language === "en" ? batchLabel(draft.batch, "en").replace(/^./, (letter) => letter.toUpperCase()) : batchLabel(draft.batch, language)) : bookedBatch.label,
                  },
                  { label: language === "hi" ? "तारीख" : language === "pa" ? "ਤਾਰੀਖ" : "Date", value: draft.date ? formatLongDate(draft.date, language) : "", mono: true },
                  { label: language === "hi" ? "टाइम" : language === "pa" ? "ਸਮਾਂ" : "Time", value: formatBatchTime(bookedBatch.time, language), mono: true },
                ]}
              />
              <div className="mt-3 flex gap-2">
                <Button type="button" className="min-h-11 flex-1 bg-primary text-primary-foreground" disabled={pending || renamePending} onClick={() => { if (renamePending) return; void send("yes", language === "hi" ? "रिक्वेस्ट भेजें" : language === "pa" ? "ਬੇਨਤੀ ਭੇਜੋ" : "Send request"); }}>
                  {language === "hi" ? "रिक्वेस्ट भेजें" : language === "pa" ? "ਬੇਨਤੀ ਭੇਜੋ" : "Send request"}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => void send("change", language === "hi" ? "एडिट करें" : language === "pa" ? "ਸੋਧੋ" : "Edit")}>
                  {language === "hi" ? "एडिट करें" : language === "pa" ? "ਸੋਧੋ" : "Edit"}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 overflow-x-auto px-4 py-3" ref={chipsRef}>
            {quick[language].map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0"
                disabled={pending}
                onClick={() => void send(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-3">
            <label htmlFor="counsellor-message" className="sr-only">
              {copy.placeholder}
            </label>
            <Input
              ref={inputRef}
              id="counsellor-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.placeholder}
              className="h-11"
              maxLength={1000}
            />
            <Button type="submit" className="min-h-11" disabled={pending || input.trim().length === 0}>
              <SendIcon data-icon="inline-start" />
              {copy.send}
            </Button>
          </form>
        </div>
      ) : (
        <Button
          ref={launcherRef}
          size="lg"
          className={cn(
            "fixed right-3 z-40 size-11 rounded-full bg-foreground p-0 text-background shadow-lg hover:bg-foreground/90",
            "md:right-4 md:h-12 md:w-auto md:px-4",
            "lg:right-6 lg:bottom-6 lg:h-[52px]",
            pathname.startsWith("/courses/") ? "bottom-24" : "bottom-3 md:bottom-4",
          )}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-label={copy.launcher}
        >
          <MessageCircleIcon data-icon="inline-start" className="size-5" />
          <span className="max-md:sr-only">{copy.launcher}</span>
        </Button>
      )}
    </>
  );
}

function MessageText({ content }: { content: string }) {
  const parts = content.split(/(UA-[A-Z0-9]+|\d{5} \d{5})/);
  return parts.map((part, index) =>
    part.startsWith("UA-") || /^\d{5} \d{5}$/.test(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
