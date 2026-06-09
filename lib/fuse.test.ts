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
