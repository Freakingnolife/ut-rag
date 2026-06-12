import { expect, test } from "vitest";
import { isHit, scoreCase, summarize, isAnswerLanguageOk } from "./eval-core";
import type { RetrievedChunk } from "./types";

const rc = (url: string): RetrievedChunk => ({
  chunkId: "c", url, title: "t", docType: "product",
  sourceType: "html-text", headingPath: [], lastmod: null, text: "x",
  cosine: 0.9, keyword: 0.5, score: 1,
});

test("isHit true when an expected URL is in retrieved chunks", () => {
  expect(isHit(["https://x.com/a"], [rc("https://x.com/a"), rc("https://x.com/b")])).toBe(true);
  expect(isHit(["https://x.com/z"], [rc("https://x.com/a")])).toBe(false);
});

test("scoreCase handles answerable and negative cases", () => {
  // answerable case: expects a hit
  expect(scoreCase({ type: "answerable", expectedUrls: ["https://x.com/a"] }, { answerable: true, chunks: [rc("https://x.com/a")] }).pass).toBe(true);
  // negative case: must decline
  expect(scoreCase({ type: "negative", expectedUrls: [] }, { answerable: false, chunks: [] }).pass).toBe(true);
  expect(scoreCase({ type: "negative", expectedUrls: [] }, { answerable: true, chunks: [rc("https://x.com/a")] }).pass).toBe(false);
});

test("isAnswerLanguageOk flags Chinese answers when English is expected", () => {
  // No constraint => always ok.
  expect(isAnswerLanguageOk(undefined, "anything")).toBe(true);
  // English answer to an English question: ok.
  expect(isAnswerLanguageOk("en", "The RSPro 2100 has a 600mm build volume.")).toBe(true);
  // A stray brand/model token in CJK doesn't fail an otherwise-English answer.
  expect(isAnswerLanguageOk("en", "The 联泰 RSPro 2100 build volume is 600mm.")).toBe(true);
  // A Chinese answer to an English question: not ok (this is the bug we're guarding).
  expect(isAnswerLanguageOk("en", "RSPro 2100 的成型尺寸为 600 毫米，适用于工业级打印。")).toBe(false);
});

test("summarize computes pass rate", () => {
  const s = summarize([{ pass: true }, { pass: false }, { pass: true }]);
  expect(s.total).toBe(3);
  expect(s.passed).toBe(2);
  expect(s.rate).toBeCloseTo(2 / 3, 5);
});
