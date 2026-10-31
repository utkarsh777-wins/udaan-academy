import { PlaneIcon } from "@/components/marks";
import { cn } from "@/lib/utils";

export function Ticket({
  eyebrow,
  from,
  to,
  fields,
  className,
}: {
  eyebrow: string;
  from: string;
  to: string;
  fields: { label: string; value: string; mono?: boolean }[];
  className?: string;
}) {
  return (
    <div role="group" aria-label="Trial class details" className={cn("rounded-[14px] border border-border bg-ticket shadow-md", className)}>
      <div className="px-5 py-5">
        <p className="eyebrow">{eyebrow}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-heading text-[22px] leading-tight font-bold">{from}</span>
          <span className="relative h-px min-w-8 flex-1 border-t-[1.5px] border-dashed border-muted-foreground">
            <PlaneIcon className="absolute -top-2 right-0 size-4 text-primary" />
          </span>
          <span className="font-heading text-[22px] leading-tight font-bold">{to}</span>
        </div>
      </div>
      <div className="relative mx-3.5 border-t-[1.5px] border-dashed border-border">
        <span className="absolute -top-2.5 -left-6 size-5 rounded-full border border-border bg-background [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute -top-2.5 -right-6 size-5 rounded-full border border-border bg-background [clip-path:inset(0_50%_0_0)]" />
      </div>
      <dl className="grid grid-cols-2 gap-3.5 px-5 py-4">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="eyebrow text-[11px]">{field.label}</dt>
            <dd className={cn("mt-0.5 text-[15.5px] font-semibold", field.mono && "num text-[14.5px] font-medium")}>{field.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
