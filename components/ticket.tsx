import { PlaneIcon } from "@/components/marks";
import { cn } from "@/lib/utils";

export function Ticket({
  eyebrow,
  from,
  to,
  fields,
  label,
  className,
}: {
  eyebrow: string;
  from?: string;
  to?: string;
  fields: { label: string; value: string; mono?: boolean; className?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("min-w-0 overflow-hidden rounded-[14px] border border-border bg-ticket shadow-md", className)}>
      <div className={cn("px-5", from && to ? "py-5" : "py-4")}>
        <p className="eyebrow">{eyebrow}</p>
        {from && to ? (
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 font-heading text-[22px] leading-tight font-bold break-words">{from}</span>
            <span className="relative h-px min-w-8 flex-1 border-t-[1.5px] border-dashed border-muted-foreground">
              <PlaneIcon className="absolute -top-2 right-0 size-4 text-primary" />
            </span>
            <span className="min-w-0 font-heading text-[22px] leading-tight font-bold break-words">{to}</span>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <div className="mx-3.5 border-t-[1.5px] border-dashed border-border" />
        <span className="absolute top-0 left-0 size-5 -translate-y-1/2 rounded-full border border-border bg-background [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute top-0 right-0 size-5 -translate-y-1/2 rounded-full border border-border bg-background [clip-path:inset(0_50%_0_0)]" />
      </div>
      <dl className="grid grid-cols-2 gap-3.5 px-5 py-4">
        {fields.map((field) => (
          <div key={field.label} className={cn("min-w-0", field.className)}>
            <dt className="eyebrow text-[11px]">{field.label}</dt>
            <dd className={cn("mt-0.5 text-[15.5px] font-semibold break-words", field.mono && "num text-[14.5px] font-medium")}>{field.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
