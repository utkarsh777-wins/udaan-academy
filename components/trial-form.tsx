"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { academy, getCourse, type BatchId } from "@/lib/academy";
import { courseCopy, ui } from "@/lib/localize";
import { buildCalendarWeeks, formatDateChipAria, formatLongDate, formatMonthHeading, WEEKDAY_SHORT } from "@/lib/dates";
import { bookableDates } from "@/lib/schedule";
import { formServerMessage } from "@/lib/chat/respond";
import { useSiteLang } from "@/components/language-provider";
import { Ticket } from "@/components/ticket";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"name" | "phone" | "course" | "batch" | "date" | "form", string>>;

export function TrialForm() {
  const language = useSiteLang();
  const copy = ui(language);
  const hi = language === "hi";
  const params = useSearchParams();
  const requested = params.get("course") ?? "";
  const initialCourse = getCourse(requested)?.slug ?? academy.courses[0]?.slug ?? "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState(initialCourse);
  const [batch, setBatch] = useState<BatchId | "">((getCourse(initialCourse)?.batches[0]?.id as BatchId | undefined) ?? "");
  const [date, setDate] = useState("");
  const [spoken, setSpoken] = useState<"en" | "hi" | "pa">(language === "hi" ? "hi" : "en");
  const [errors, setErrors] = useState<Errors>({});
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState("");
  const nameId = useId();
  const phoneId = useId();
  const courseErrorId = useId();
  const batchErrorId = useId();
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const phoneHintId = useId();
  const dateErrorId = useId();
  const formErrorId = useId();
  const courseRef = useRef<HTMLFieldSetElement>(null);
  const batchRef = useRef<HTMLFieldSetElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLFieldSetElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const focusFormError = useRef(false);

  const selected = getCourse(course);
  const shown = selected ? courseCopy(selected, language) : null;
  const chosen = shown?.batches.find((item) => item.id === batch);
  const dates = chosen ? bookableDates(chosen.weekdays, chosen.time) : [];
  const calendarMonths = buildCalendarWeeks(dates);

  useEffect(() => {
    if (!focusFormError.current || !errors.form) return;
    focusFormError.current = false;
    formErrorRef.current?.focus();
  }, [errors.form, review]);

  function focusFirstInvalid(next: Errors) {
    const order = [
      ["course", courseRef],
      ["batch", batchRef],
      ["name", nameRef],
      ["phone", phoneRef],
      ["date", dateRef],
    ] as const;
    const found = order.find(([key]) => next[key]);
    found?.[1].current?.focus();
  }

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = copy.errName;
    const digits = phone.replace(/\D/g, "");
    const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
    if (!/^[6-9]\d{9}$/.test(local)) next.phone = copy.errPhone;
    if (!selected) next.course = copy.errCourse;
    if (!chosen) next.batch = copy.errBatch;
    if (!date || !dates.includes(date)) next.date = copy.errDate;
    return next;
  }

  async function send() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length || !chosen) return;
    setPending(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: local, course, batch, date, language: spoken, source: "form" }),
      });
      const body = (await response.json()) as {
        booking?: { id: string };
        message?: string;
        error?: string;
        fields?: string[];
        limit?: "phone" | "ip" | "site";
        dateReason?: "window" | "weekday" | "ended";
      };
      if (!response.ok || !body.booking) {
        const server: Errors = {};
        if (body.fields?.includes("name")) server.name = copy.errName;
        if (body.fields?.includes("phone")) server.phone = copy.errPhone;
        if (body.fields?.includes("course")) server.course = copy.errCourse;
        if (body.fields?.includes("batch")) server.batch = copy.errBatch;
        if (body.fields?.includes("date")) {
          server.date =
            body.dateReason === "weekday" ? copy.errWeekday : body.dateReason === "ended" ? copy.errEnded : body.dateReason === "window" ? copy.errWindow : copy.errDate;
        }
        const fieldError = Boolean(server.name || server.phone || server.course || server.batch || server.date);
        if (!fieldError) server.form = body.error || body.message ? formServerMessage(language, body) : copy.errForm;
        focusFormError.current = !fieldError;
        setErrors(server);
        setReview(false);
        if (fieldError) focusFirstInvalid(server);
        return;
      }
      setReference(body.booking.id);
    } catch {
      setErrors({ form: copy.errConnection });
    } finally {
      setPending(false);
    }
  }

  if (reference && shown && chosen) {
    return (
      <div className="rounded-[20px] border border-border bg-card p-6">
        <p className="inline-flex rounded-full bg-success-bg px-2 py-1 text-sm font-semibold text-success">{hi ? "रिक्वेस्ट भेज दी" : "Request sent"}</p>
        <p className="num mt-3 text-lg">{reference}</p>
        <p className="mt-2 text-muted-foreground">{hi ? "डेस्क फ़ोन करके पक्का करेगा।" : "The front desk will call you to confirm."}</p>
        <Ticket
          className="mt-4"
          label={copy.ticketLabel}
          eyebrow={hi ? "फ़्री ट्रायल क्लास" : "Free trial class"}
          from={hi ? "फगवाड़ा" : "Phagwara"}
          to={shown.name}
          fields={[
            { label: hi ? "कोर्स" : "Course", value: shown.name },
            { label: hi ? "बैच" : "Batch", value: chosen.label },
            { label: hi ? "तारीख" : "Date", value: formatLongDate(date, language), mono: true },
            { label: hi ? "टाइम" : "Time", value: chosen.time, mono: true },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form
        className="min-w-0 rounded-[20px] border border-border bg-card p-5 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (review) void send();
          else {
            const next = validate();
            setErrors(next);
            if (Object.keys(next).length) focusFirstInvalid(next);
            else setReview(true);
          }
        }}
        noValidate
      >
        <p className="mb-6 text-sm text-muted-foreground">
          <span className="text-margin">1</span> {hi ? "कोर्स" : "Course"} · <span className="text-margin">2</span> {hi ? "डिटेल" : "Your details"} · <span className="text-margin">3</span> {hi ? "पक्का करें" : "Confirm"}
        </p>
        <fieldset ref={courseRef} tabIndex={-1} className="mb-5 outline-none" aria-invalid={Boolean(errors.course)} aria-describedby={errors.course ? courseErrorId : undefined}>
          <legend className="mb-2 font-semibold">{copy.formCourse}</legend>
          <div className="flex flex-wrap gap-2">
            {academy.courses.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={course === item.slug}
                onClick={() => {
                  setCourse(item.slug);
                  setBatch((getCourse(item.slug)?.batches[0]?.id as BatchId | undefined) ?? "");
                  setDate("");
                  setReview(false);
                }}
                className={cn(
                  "min-h-10 rounded-[10px] border px-3.5 py-1.5 text-left text-sm font-medium",
                  course === item.slug ? "border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--primary)]" : "border-border bg-card",
                )}
              >
                {courseCopy(item, language).name}
              </button>
            ))}
          </div>
          {errors.course ? (
            <p id={courseErrorId} className="mt-2 text-sm text-destructive">
              {errors.course}
            </p>
          ) : null}
        </fieldset>
        <fieldset ref={batchRef} tabIndex={-1} className="mb-5 outline-none" aria-invalid={Boolean(errors.batch)} aria-describedby={errors.batch ? batchErrorId : undefined}>
          <legend className="mb-2 font-semibold">{copy.formBatch}</legend>
          <div className="flex flex-wrap gap-2">
            {(shown?.batches ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={batch === item.id}
                onClick={() => {
                  setBatch(item.id as BatchId);
                  setDate("");
                  setReview(false);
                }}
                className={cn(
                  "min-h-10 rounded-[10px] border px-3.5 py-1.5 text-left text-sm",
                  batch === item.id ? "border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--primary)]" : "border-border bg-card",
                )}
              >
                {item.label}
                <small className="num mt-0.5 block text-xs font-normal text-muted-foreground">{item.days} · {item.time}</small>
              </button>
            ))}
          </div>
          {errors.batch ? (
            <p id={batchErrorId} className="mt-2 text-sm text-destructive">
              {errors.batch}
            </p>
          ) : null}
        </fieldset>
        <label className="mb-4 block" htmlFor={nameId}>
          <span className="mb-1.5 block font-semibold">{hi ? "छात्र का नाम" : "Student name"}</span>
          <input
            id={nameId}
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 w-full rounded-[10px] border border-input bg-card px-3 text-base"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? nameErrorId : undefined}
          />
          {errors.name ? (
            <span id={nameErrorId} className="mt-1 block text-sm text-destructive">
              {errors.name}
            </span>
          ) : null}
        </label>
        <label className="mb-4 block" htmlFor={phoneId}>
          <span className="mb-1.5 block font-semibold">{copy.formPhone}</span>
          <input
            id={phoneId}
            ref={phoneRef}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            className="h-12 w-full rounded-[10px] border border-input bg-card px-3 text-base"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? phoneErrorId : phoneHintId}
          />
          {errors.phone ? (
            <span id={phoneErrorId} className="mt-1 block text-sm text-destructive">
              {errors.phone}
            </span>
          ) : (
            <span id={phoneHintId} className="mt-1 block text-[13.5px] text-muted-foreground">
              {copy.formPhoneHint}
            </span>
          )}
        </label>
        <fieldset ref={dateRef} tabIndex={-1} className="mb-5 min-w-0 outline-none" aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? dateErrorId : undefined}>
          <legend className="mb-2 font-semibold">{copy.formDate}</legend>
          {chosen ? (
            <div className="grid grid-cols-7 gap-1" aria-label={copy.formDate}>
              {calendarMonths.map((m, monthIdx) => (
                <Fragment key={m.key}>
                  <div
                    data-month-heading="true"
                    className={cn(
                      "col-span-7 text-sm font-semibold text-foreground",
                      monthIdx === 0 ? "pt-1 pb-1" : "pt-4 pb-1",
                    )}
                  >
                    {formatMonthHeading(m.year, m.month, language)}
                  </div>
                  {monthIdx === 0
                    ? WEEKDAY_SHORT[language].map((name) => (
                        <div
                          key={name}
                          data-weekday-header="true"
                          className="flex h-6 min-w-0 items-center justify-center text-center text-xs font-medium text-muted-foreground"
                        >
                          {name}
                        </div>
                      ))
                    : null}
                  {m.weeks.map((week, weekIdx) =>
                    week.map((cell) =>
                      cell.bookable ? (
                        <button
                          key={cell.iso}
                          type="button"
                          aria-pressed={date === cell.iso}
                          aria-label={formatDateChipAria(cell.iso, language)}
                          onClick={() => setDate(cell.iso)}
                          className={cn(
                            "flex h-10 min-w-0 items-center justify-center rounded-[8px] border p-0 text-xs font-medium sm:text-sm",
                            date === cell.iso
                              ? "border-primary bg-foreground text-background"
                              : "border-border bg-card hover:bg-accent",
                          )}
                        >
                          {cell.day}
                        </button>
                      ) : (
                        <div
                          key={`placeholder-${m.key}-${cell.iso}-${weekIdx}`}
                          aria-hidden="true"
                          data-placeholder="true"
                          className="h-10 min-w-0"
                        />
                      ),
                    ),
                  )}
                </Fragment>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{hi ? "पहले बैच चुनिए।" : "Choose a batch first."}</p>
          )}
          {errors.date ? (
            <p id={dateErrorId} className="mt-2 text-sm text-destructive">
              {errors.date}
            </p>
          ) : null}
          {date ? <p className="mt-2 text-sm text-muted-foreground">{formatLongDate(date, language)}</p> : null}
        </fieldset>
        <label className="mb-4 block">
          <span className="mb-1.5 block font-semibold">{hi ? "पसंदीदा भाषा" : "Preferred language"}</span>
          <select
            value={spoken}
            onChange={(event) => setSpoken(event.target.value as "en" | "hi" | "pa")}
            className="h-12 w-full rounded-[10px] border border-input bg-card px-3 text-base"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
          </select>
        </label>
        {errors.form ? (
          <p ref={formErrorRef} id={formErrorId} tabIndex={-1} role="alert" className="mb-3 text-sm text-destructive outline-none">
            {errors.form}
          </p>
        ) : null}
        {review && shown && chosen ? (
          <div className="mb-4">
            <Ticket
              label={copy.ticketLabel}
              eyebrow={hi ? "फ़्री ट्रायल क्लास" : "Free trial class"}
              fields={[
                { label: hi ? "नाम" : "Name", value: name },
                { label: hi ? "फ़ोन" : "Phone", value: phone, mono: true },
                { label: hi ? "कोर्स" : "Course", value: shown.name, className: "lg:hidden" },
                { label: hi ? "बैच" : "Batch", value: chosen.label, className: "lg:hidden" },
                { label: hi ? "तारीख" : "Date", value: formatLongDate(date, language), mono: true },
                { label: hi ? "टाइम" : "Time", value: chosen.time, mono: true },
              ]}
            />
          </div>
        ) : null}
        <button type="submit" disabled={pending} className="h-[52px] w-full rounded-[10px] bg-primary font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          {pending ? copy.sending : review ? (hi ? "रिक्वेस्ट भेजें" : "Send request") : hi ? "बुकिंग देखें" : "Review booking"} →
        </button>
        {review ? (
          <button type="button" className="mt-3 h-11 w-full rounded-[10px] border border-border" onClick={() => setReview(false)}>
            {hi ? "एडिट करें" : "Edit"}
          </button>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">{hi ? "नंबर सिर्फ़ इस ट्रायल को पक्का करने के लिए है। ईमेल या एसएमएस अपने आप नहीं जाता।" : "We only use your number to confirm this trial. No email or SMS is sent automatically."}</p>
      </form>
      <aside className={cn("lg:sticky lg:top-24", review && "hidden lg:block")}>
        <p className="mb-3 font-semibold">{hi ? "आपका ट्रायल पास" : "Your trial pass"}</p>
        <Ticket
          label={copy.ticketLabel}
          eyebrow={hi ? "फ़्री ट्रायल क्लास" : "Free trial class"}
          from={hi ? "फगवाड़ा" : "Phagwara"}
          to={shown?.name ?? "—"}
          fields={[
            { label: hi ? "कोर्स" : "Course", value: shown?.name ?? "—" },
            { label: hi ? "बैच" : "Batch", value: chosen?.label ?? "—" },
            { label: hi ? "तारीख" : "Date", value: date ? formatLongDate(date, language) : "—", mono: true },
            { label: hi ? "टाइम" : "Time", value: chosen?.time ?? "—", mono: true },
          ]}
        />
      </aside>
    </div>
  );
}
