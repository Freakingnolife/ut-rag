import type { Chunk } from "./types";

// Common English function words that add noise to query keyword matching
const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","up","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","shall","should",
  "may","might","can","could","what","where","when","why","which",
  "that","this","these","those","it","its","not","no","nor","so","as",
  "if","then","than","while","we","our","you","your","they","their",
  "he","she","his","her","all","been","there","here","some","any",
  // colloquial fillers — keep keyword overlap focused on content words
  "stuff","guys","yall","u","ur","wats","whats","plz","pls","ya",
  "hey","hi","hello","thanks","gonna","wanna",
]);

// CJK has no word boundaries; character bigrams are the standard segmenter-free unit.
const CJK_RUN = /[一-鿿㐀-䶿]+/;
const TOKEN_RE = new RegExp(`[a-z0-9]+|${CJK_RUN.source}`, "g");

function cjkBigrams(run: string): string[] {
  if (run.length === 1) return [run];
  const out: string[] = [];
  for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  return out;
}

// "lite600" must match docs that write "Lite 600": keep the full run and add
// letter/digit segments, but only segments of 2+ chars ("3d" stays whole).
function splitLetterDigit(run: string): string[] {
  const segs = run.match(/[a-z]+|[0-9]+/g) ?? [];
  if (segs.length <= 1) return [run];
  return [run, ...segs.filter((s) => s.length >= 2)];
}

export function tokenize(s: string): string[] {
  const runs = s.toLowerCase().match(TOKEN_RE) ?? [];
  return runs.flatMap((r) => (CJK_RUN.test(r) ? cjkBigrams(r) : splitLetterDigit(r)));
}

// Like tokenize but removes stopwords — use for query tokens only, not document tokens.
export function tokenizeQuery(s: string): string[] {
  return tokenize(s).filter((t) => !STOPWORDS.has(t));
}

export function keywordScores(records: Chunk[], query: string): number[] {
  const qTokens = tokenizeQuery(query);
  const qSet = new Set(qTokens);
  if (qSet.size === 0) return records.map(() => 0);
  return records.map((r) => {
    // Include title tokens so pages with brand names only in their title still match
    const docTokens = new Set([...tokenize(r.text), ...tokenize(r.title ?? "")]);
    let overlap = 0;
    for (const t of qSet) if (docTokens.has(t)) overlap++;
    return overlap / qSet.size;
  });
}

// A "model token" has a digit (e.g. "2100", "600"). Exact match = present verbatim.
// Includes title tokens so model numbers appearing only in the page title are found.
export function hasExactModelMatch(record: Chunk, query: string): boolean {
  const modelTokens = tokenize(query).filter((t) => /\d/.test(t));
  if (modelTokens.length === 0) return false;
  const docTokens = new Set([...tokenize(record.text), ...tokenize(record.title ?? "")]);
  return modelTokens.some((t) => docTokens.has(t));
}

// Stricter than hasExactModelMatch: the query's model number is in the page URL slug, not
// just body text. The slug is canonical — "/products/rspro-2100-..." unambiguously IS the
// 2100 page — so this distinguishes the model's own catalog page from a comparison page that
// merely lists it (whose slug carries a different model), and from CMS-generic <title> tags
// that omit the model entirely. Product titles/slugs never carry stray year tokens, so it
// won't fire on off-topic queries like "2022 World Cup".
export function hasModelInUrl(record: Chunk, query: string): boolean {
  const modelTokens = tokenize(query).filter((t) => /\d/.test(t));
  if (modelTokens.length === 0) return false;
  const urlTokens = new Set(tokenize(record.url));
  return modelTokens.some((t) => urlTokens.has(t));
}
