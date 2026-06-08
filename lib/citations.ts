import type { SourceRef } from "./types";

export function parseCitations(answer: string): number[] {
  const found = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return [...new Set(found)];
}

export function validateCitations(
  answer: string,
  sources: SourceRef[],
): { citations: SourceRef[]; cleanedAnswer: string } {
  const valid = new Set(sources.map((s) => s.n));
  const used = parseCitations(answer).filter((n) => valid.has(n));
  const cleanedAnswer = answer.replace(/\[(\d+)\]/g, (full, d) =>
    valid.has(Number(d)) ? full : "",
  );
  const citations = sources.filter((s) => used.includes(s.n));
  return { citations, cleanedAnswer };
}
