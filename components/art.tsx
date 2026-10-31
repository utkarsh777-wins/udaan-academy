export function PaperPlane({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M6 34 58 8 40 56l-10-16L6 34Z" fill="currentColor" />
      <path d="M30 40 58 8 34 36l-4 4Z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function Monogram({ initials, label }: { initials: string; label: string }) {
  return (
    <svg viewBox="0 0 80 80" role="img" aria-label={label} className="size-16 text-primary">
      <rect width="80" height="80" rx="22" className="fill-accent" />
      <text
        x="40"
        y="49"
        textAnchor="middle"
        fontSize="24"
        fontFamily="var(--font-noto), sans-serif"
        fontWeight="700"
        className="fill-foreground"
      >
        {initials}
      </text>
    </svg>
  );
}

export function StudyHall({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 480 520"
      role="img"
      aria-label={label}
      className="h-auto w-full"
    >
      <rect width="480" height="520" rx="28" fill="#f3ead6" />
      <rect x="0" y="360" width="480" height="160" fill="#e7c56a" />
      <rect x="0" y="360" width="480" height="18" fill="#1c293f" opacity="0.12" />
      <rect x="70" y="150" width="250" height="210" rx="8" fill="#1c293f" />
      <polygon points="58,158 195,78 332,158" fill="#91380e" />
      <rect x="96" y="188" width="58" height="72" rx="4" fill="#faf7ec" />
      <rect x="170" y="188" width="58" height="72" rx="4" fill="#f5dc98" />
      <rect x="244" y="188" width="52" height="72" rx="4" fill="#faf7ec" />
      <rect x="156" y="286" width="70" height="74" rx="4" fill="#faf7ec" />
      <rect x="40" y="300" width="36" height="90" rx="18" fill="#2f6b45" />
      <circle cx="58" cy="286" r="28" fill="#3d7d52" />
      <rect x="330" y="250" width="110" height="16" rx="4" fill="#1c293f" />
      <rect x="342" y="266" width="86" height="12" rx="3" fill="#91380e" />
      <rect x="354" y="278" width="62" height="12" rx="3" fill="#1c293f" />
      <path d="M300 120 430 70 380 190l-28-42-52-28Z" fill="#faf7ec" />
      <path d="M352 148 430 70 366 138l-14 10Z" fill="#91380e" />
      <circle cx="390" cy="48" r="16" fill="#faf7ec" opacity="0.8" />
    </svg>
  );
}

export function PlaceCard({ label, caption }: { label: string; caption: string }) {
  return (
    <svg
      viewBox="0 0 360 180"
      role="img"
      aria-label={label}
      className="h-auto w-full"
    >
      <rect width="360" height="180" rx="16" fill="#1c293f" />
      <path d="M0 120 C 80 90, 140 150, 220 110 S 320 80, 360 120 V 180 H 0 Z" fill="#e7c56a" />
      <path d="M20 70 H 160" stroke="#faf7ec" strokeWidth="4" />
      <path d="M40 90 H 120" stroke="#f5dc98" strokeWidth="4" />
      <circle cx="250" cy="64" r="18" fill="none" stroke="#faf7ec" strokeWidth="4" />
      <path d="M250 46 V 28" stroke="#faf7ec" strokeWidth="4" />
      <text x="24" y="48" fill="#faf7ec" fontSize="18" fontFamily="var(--font-noto), sans-serif">
        {caption}
      </text>
    </svg>
  );
}
