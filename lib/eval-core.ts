import type { RetrievedChunk } from "./types";

export interface GoldenCase {
  type: "answerable" | "negative";
  expectedUrls: string[];
  question?: string;
}

export interface CaseOutcome {
  answerable: boolean;
  chunks: RetrievedChunk[];
}

export function isHit(expectedUrls: string[], chunks: RetrievedChunk[]): boolean {
  const got = new Set(chunks.map((c) => c.url));
  return expectedUrls.some((u) => got.has(u));
}

export function scoreCase(gc: GoldenCase, out: CaseOutcome): { pass: boolean } {
  if (gc.type === "negative") return { pass: out.answerable === false };
  return { pass: out.answerable === true && isHit(gc.expectedUrls, out.chunks) };
}

export function summarize(results: { pass: boolean }[]): { total: number; passed: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, rate: results.length ? passed / results.length : 0 };
}
