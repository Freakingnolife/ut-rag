export function isPdfUrl(url: string): boolean {
  return new URL(url).pathname.toLowerCase().endsWith(".pdf");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOpts {
  retries: number;
  baseDelayMs: number;
}

export async function fetchWithRetry(
  url: string,
  opts: RetryOpts,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": "UnionTechRAGBot" } });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < opts.retries) await sleep(opts.baseDelayMs * Math.pow(2, attempt));
  }
  throw new Error(`fetchWithRetry failed for ${url}: ${String(lastErr)}`);
}
