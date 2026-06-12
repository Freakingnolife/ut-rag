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

test("fuseAndRank lifts the product spec page above news/case pages when the query names its model", () => {
  // Reproduces the live failure on "build volume of the RSPro 2100": embo-01 ranks
  // marketing/news copy above the catalog page, so the product page falls out of the
  // semantic top-N and survives only via a single keyword-RRF contribution — which
  // news/case pages (two contributions each) outscore.
  const records = [
    mk("news0", "news", "rspro 2100 unveiled at formnext, a milestone for large build prototypes", "2026-01-01"),
    mk("news1", "news", "uniontech and 3d printing help produce parts", "2026-01-01"),
    mk("case0", "case", "one of china's am pioneers builds with sla", "2026-01-01"),
    // CMS gives the catalog page a generic <title>; the model lives only in the URL slug.
    { ...mk("prod", "product", "build volume 600 x 600 x 400 mm specifications", "2026-01-01"), url: "https://x/products/rspro-2100-large-sla-printer.html" },
  ];
  const semantic = [{ idx: 0, score: 0.68 }, { idx: 1, score: 0.66 }, { idx: 2, score: 0.64 }];
  const keyword = [0.5, 0.2, 0.2, 1.0];
  const query = "what is the build volume of the rspro 2100";
  const ranked = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 4, query });
  expect(ranked[0].chunkId).toBe("prod");
});

test("fuseAndRank boosts the model's own page by URL slug, not another product that mentions it in a table", () => {
  // The live bug: rspro800-x / rspro-1400 list "2100" in a comparison table (body text),
  // so a body-text model match wrongly boosted them above the real RSPro 2100 page. The URL
  // slug — rspro-800x vs rspro-2100 — is what tells them apart.
  const records = [
    { ...mk("other", "product", "rspro 800x specs. comparison vs rspro 2100 and rspro 1400", "2026-01-01"), url: "https://x/products/rspro-800x.html" },
    { ...mk("prod", "product", "build volume specifications", "2026-01-01"), url: "https://x/products/rspro-2100-large-sla-printer.html" },
  ];
  const semantic = [{ idx: 0, score: 0.68 }];
  const keyword = [1.0, 0.6];
  const ranked = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 2, query: "rspro 2100 build volume" });
  expect(ranked[0].chunkId).toBe("prod");
});

test("fuseAndRank model boost does not fire for queries without a model number", () => {
  // Same shape as the boost test, but the query names no model number — so the
  // product page must NOT be lifted and the case page stays on top.
  const records = [
    mk("news0", "news", "unveiled at formnext, a milestone for large build prototypes", "2026-01-01"),
    mk("case0", "case", "one of china's am pioneers builds with sla", "2026-01-01"),
    mk("prod", "product", "build volume 600 x 600 x 400 mm specifications", "2026-01-01"),
  ];
  const semantic = [{ idx: 0, score: 0.68 }, { idx: 1, score: 0.64 }];
  const keyword = [0.5, 0.2, 1.0];
  const ranked = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 3, query: "what build volume do your large printers have" });
  expect(ranked[0].chunkId).not.toBe("prod");
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

test("shouldAnswer answers when the model's own catalog page surfaced by URL slug despite cold cosine", () => {
  // "RS Pro 2100 specs": tokenizes as rs/pro (not "rspro") so keyword is weak, and embo-01
  // dropped the page from the semantic top-N so cosine is 0 — but the URL slug IS rspro-2100,
  // and the model boost already made it the top result. Don't refuse the page we just chose.
  const hit: RetrievedChunk[] = [
    { ...mk("1", "product", "rspro 2100 specifications build volume"), url: "u/products/rspro-2100-large-sla-printer.html", cosine: 0.0, keyword: 0.25, score: 0.05 },
  ];
  expect(shouldAnswer(hit, "RS Pro 2100 specs")).toBe(true);
});

test("shouldAnswer still refuses an off-topic year that matches no product slug", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "news", "company funding"), cosine: 0.45, keyword: 0.2, score: 0.1 }];
  expect(shouldAnswer(hit, "Who won the 2022 FIFA World Cup?")).toBe(false);
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
