const TRACKING = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "ref",
];

export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  for (const k of TRACKING) u.searchParams.delete(k);
  const qs = u.searchParams.toString();
  u.search = qs ? `?${qs}` : "";
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

export function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.map(normalizeUrl))];
}
