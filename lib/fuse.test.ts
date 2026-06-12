import { expect, test } from "vitest";
import { rrf, authorityWeight, fuseAndRank, shouldAnswer } from "./fuse";
import type { Chunk, RetrievedChunk } from "./types";

const mk = (id: string, docType: Chunk["docType"], text: string, lastmod: string | null = null): Chunk => ({
  chunkId: id, url: `u/${id}`, title: id, docType,
  sourceType: "html-text", headingPath: [], lastmod, text,
});

test("rrf rewards items ranked high across lists", () => {
  const m = rrf([[2, 0, 1], [0, 2, 1]], 60); // idx 0 and 2 both appear near top
  expect(m.get(0)).toBeGreaterThan(m.get(1)!);
});

test("authorityWeight favors product over blog and recent over old", () => {
  const now = "2026-06-09T00:00:00Z";
  expect(authorityWeight("product", null, now)).toBeGreaterThan(authorityWeight("blog", null, now));
  expect(authorityWeight("product", "2026-01-01", now))
    .toBeGreaterThan(authorityWeight("product", "2019-01-01", now));
});

test("fuseAndRank surfaces the product spec chunk above an old blog mention", () => {
  const records = [
    mk("0", "blog", "rspro 2100 was launched", "2019-01-01"),
    mk("1", "product", "Build Volume: 600x600x400 mm rspro 2100", "2026-01-01"),
  ];
  const semantic = [{ idx: 0, score: 0.7 }, { idx: 1, score: 0.69 }];
  const keyword = [0.5, 0.9];
  const ranked = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 2 });
  expect(ranked[0].chunkId).toBe("1");
  expect(ranked[0].cosine).toBeCloseTo(0.69, 5);
});

test("shouldAnswer rescues strong-keyword chunks just below the cosine floor", () => {
  // colloquial query: right page found (kw 1.0) but slang depresses cosine
  const hit: RetrievedChunk[] = [{ ...mk("1", "blog", "resin shoe molds printers"), cosine: 0.59, keyword: 1.0, score: 0.9 }];
  expect(shouldAnswer(hit, "can your printers make shoes")).toBe(true);
});

test("shouldAnswer rescues full-keyword match down to the lower floor", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "product", "dental 3d printer d300"), cosine: 0.42, keyword: 1.0, score: 0.9 }];
  expect(shouldAnswer(hit, "do yall do dental stuff")).toBe(true);
});

test("shouldAnswer does not rescue weak keyword overlap below the floor", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "news", "company funding round"), cosine: 0.57, keyword: 0.5, score: 0.9 }];
  expect(shouldAnswer(hit, "wats the biggest printer u guys sell")).toBe(false);
});

test("shouldAnswer does not rescue strong keyword on cold cosine", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "blog", "totally different topic"), cosine: 0.3, keyword: 1.0, score: 0.9 }];
  expect(shouldAnswer(hit, "some query")).toBe(false);
});

test("shouldAnswer declines on weak cosine and no exact match", () => {
  const weak: RetrievedChunk[] = [{ ...mk("0", "blog", "unrelated"), cosine: 0.1, keyword: 0, score: 0.1 }];
  expect(shouldAnswer(weak, "totally unrelated question")).toBe(false);
});

test("shouldAnswer answers when an exact model match exists at or above COSINE_FLOOR_MODEL_MATCH", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "product", "rspro 2100 build volume 600mm"), cosine: 0.52, keyword: 0.8, score: 0.9 }];
  expect(shouldAnswer(hit, "rspro 2100 build volume")).toBe(true);
});

test("shouldAnswer rejects model match when cosine is below COSINE_FLOOR_MODEL_MATCH", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "product", "rspro 2100 build volume 600mm"), cosine: 0.3, keyword: 0.8, score: 0.9 }];
  expect(shouldAnswer(hit, "rspro 2100 build volume")).toBe(false);
});

test("shouldAnswer requires the model-match chunk itself to meet COSINE_FLOOR_MODEL_MATCH", () => {
  // top[0] has acceptable cosine but no model number; top[1] has model but low cosine
  const chunks: RetrievedChunk[] = [
    { ...mk("0", "blog", "general 3d printing article"), cosine: 0.55, keyword: 0.4, score: 0.8 },
    { ...mk("1", "product", "rspro 2100 build volume"), cosine: 0.3, keyword: 0.9, score: 0.7 },
  ];
  // top[0].cosine >= COSINE_FLOOR_MODEL_MATCH but the model-match chunk (top[1]) is below floor
  expect(shouldAnswer(chunks, "rspro 2100 build volume")).toBe(false);
});

test("shouldAnswer answers when model-match chunk itself meets COSINE_FLOOR_MODEL_MATCH", () => {
  // top[0] has acceptable cosine but no model; top[1] has model AND adequate cosine
  const chunks: RetrievedChunk[] = [
    { ...mk("0", "blog", "general 3d printing article"), cosine: 0.55, keyword: 0.4, score: 0.8 },
    { ...mk("1", "product", "rspro 2100 build volume"), cosine: 0.52, keyword: 0.9, score: 0.7 },
  ];
  expect(shouldAnswer(chunks, "rspro 2100 build volume")).toBe(true);
});

test("fuseAndRank handles topK larger than qualifying chunk count without crashing", () => {
  const records = [mk("0", "blog", "foo", null)];
  const semantic = [{ idx: 0, score: 0.8 }];
  const keyword = [0.5];
  const result = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 10 });
  expect(result.length).toBeLessThanOrEqual(1);
});

test("fuseAndRank returns keyword-only results when semantic list is empty", () => {
  const records = [
    mk("0", "product", "rspro 2100 build volume", null),
    mk("1", "blog", "unrelated blog post", null),
  ];
  const keyword = [0.9, 0.1];
  const result = fuseAndRank({ records, semantic: [], keyword, nowIso: "2026-06-09T00:00:00Z", topK: 2 });
  expect(result[0].chunkId).toBe("0");
});
