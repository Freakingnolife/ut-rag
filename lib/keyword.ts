import type { Chunk } from "./types";

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean);
}

export function keywordScores(records: Chunk[], query: string): number[] {
  const qTokens = tokenize(query);
  const qSet = new Set(qTokens);
  if (qSet.size === 0) return records.map(() => 0);
  return records.map((r) => {
    const docTokens = new Set(tokenize(r.text));
    let overlap = 0;
    for (const t of qSet) if (docTokens.has(t)) overlap++;
    return overlap / qSet.size;
  });
}

// A "model token" has a digit (e.g. "2100", "600"). Exact match = present verbatim.
export function hasExactModelMatch(record: Chunk, query: string): boolean {
  const modelTokens = tokenize(query).filter((t) => /\d/.test(t));
  if (modelTokens.length === 0) return false;
  const docTokens = new Set(tokenize(record.text));
  return modelTokens.some((t) => docTokens.has(t));
}
