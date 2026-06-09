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
]);

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean);
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
