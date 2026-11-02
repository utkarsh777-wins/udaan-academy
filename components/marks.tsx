export function LogoMark({ className = "size-[34px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="currentColor" className="text-primary" />
      <path
        d="M7 24c6-1 12-6 16-13"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="1.6"
        strokeDasharray="2.2 2.6"
        strokeLinecap="round"
      />
      <path d="m20.5 9.5 6-2-2 6-1.6-2.4Z" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function PlaneIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2.5 11.5 21 4l-5.5 16-4-6.5-9-2Z" strokeLinejoin="round" />
      <path d="m11.5 13.5 4-4" />
    </svg>
  );
}

export function RoadMap({ language = "en" }: { language?: "en" | "hi" }) {
  const hi = language === "hi";
  return (
    <div className="h-full min-h-56 overflow-hidden rounded-[14px] border border-border bg-card">
      <svg viewBox="0 0 520 300" className="h-full w-full" role="img" aria-label={hi ? "जी.टी. रोड का बना हुआ स्केच, लाइव नक्शा नहीं" : "A drawn sketch of GT Road, not a live map"}>
        <path d="M-10 210 L530 120" stroke="var(--border)" strokeWidth="22" />
        <path d="M-10 210 L530 120" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="10 10" />
        <text x="40" y="236" fill="var(--muted-foreground)" fontSize="12" fontFamily="var(--font-anek-deva), var(--font-plex-mono), sans-serif" transform="rotate(-9.5 40 236)">
          {hi ? "जी.टी. रोड · एनएच 44" : "GT ROAD · NH 44"}
        </text>
        <circle cx="300" cy="160" r="7" fill="var(--primary)" />
        <circle cx="300" cy="160" r="15" fill="none" stroke="var(--primary)" strokeOpacity="0.35" />
        <text x="316" y="150" fill="var(--foreground)" fontSize="15" fontWeight="600" fontFamily="var(--font-anek-deva), var(--font-anek-latin), sans-serif">
          {hi ? "उड़ान अकादमी" : "Udaan Academy"}
        </text>
        <text x="30" y="40" fill="var(--muted-foreground)" fontSize="11" fontFamily="var(--font-anek-deva), var(--font-plex-mono), sans-serif">
          {hi ? "← जालंधर" : "← JALANDHAR"}
        </text>
        <text x="390" y="270" fill="var(--muted-foreground)" fontSize="11" fontFamily="var(--font-anek-deva), var(--font-plex-mono), sans-serif">
          {hi ? "लुधियाना →" : "LUDHIANA →"}
        </text>
      </svg>
    </div>
  );
}
