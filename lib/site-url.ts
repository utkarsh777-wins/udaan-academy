/** Absolute site URL from NEXT_PUBLIC_SITE_URL or the Vercel production host. Null when neither is set, so metadata stays relative instead of pointing at localhost. */
export function getSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}
