import type { RetrievedChunk } from "./types";

export interface GoldenCase {
  type: "answerable" | "negative";
  expectedUrls: string[];
  question?: string;
  /** If set, the generated answer must be in this language. Currently only "en" is checked. */
  expectLang?: "en";
}

/**
 * Guards the "English question -> Chinese answer" failure mode: when "en" is expected,
 * an answer fails if CJK characters make up more than 10% of its non-whitespace content.
 * The threshold tolerates stray brand/model tokens (e.g. 联泰) without flagging the answer.
 */
export function isAnswerLanguageOk(expectLang: "en" | undefined, answer: string): boolean {
  if (expectLang !== "en") return true;
  const nonSpace = answer.replace(/\s/g, "");
  if (nonSpace.length === 0) return true;
  const cjk = (nonSpace.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return cjk / nonSpace.length <= 0.1;
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
