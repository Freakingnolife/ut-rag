import { expect, test } from "vitest";
import { isHit, scoreCase, summarize } from "./eval-core";
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

test("summarize computes pass rate", () => {
  const s = summarize([{ pass: true }, { pass: false }, { pass: true }]);
  expect(s.total).toBe(3);
  expect(s.passed).toBe(2);
  expect(s.rate).toBeCloseTo(2 / 3, 5);
});
