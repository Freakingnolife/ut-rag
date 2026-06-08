import { expect, test } from "vitest";
import { retrieve } from "./retrieve";
import type { Chunk, LoadedIndex, ChatMessage } from "./types";

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "RSPro 2100", docType: "product", sourceType: "html-table", headingPath: [], lastmod: "2026-01-01", text: "Build Volume: 600x600x400 mm rspro 2100" },
  { chunkId: "c1", url: "u1", title: "Blog", docType: "blog", sourceType: "html-text", headingPath: [], lastmod: "2019-01-01", text: "dental resin colors" },
];
// dim 2, normalized rows: c0 -> +x, c1 -> +y
const index: LoadedIndex = { dim: 2, records, matrix: new Float32Array([1, 0, 0, 1]) };

test("retrieve returns ranked chunks and marks answerable for an on-topic query", async () => {
  const deps = {
    index,
    embedQuery: async (_q: string) => [1, 0], // aligns with c0
    complete: async (_m: ChatMessage[]) => "unused",
    nowIso: "2026-06-09T00:00:00Z",
  };
  const res = await retrieve("rspro 2100 build volume", [], deps);
  expect(res.chunks[0].chunkId).toBe("c0");
  expect(res.answerable).toBe(true);
  expect(res.query).toBe("rspro 2100 build volume");
});

test("retrieve declines for an off-topic query", async () => {
  const deps = {
    index,
    embedQuery: async (_q: string) => [-1, -1], // points away from everything
    complete: async (_m: ChatMessage[]) => "unused",
    nowIso: "2026-06-09T00:00:00Z",
  };
  const res = await retrieve("how do I bake bread", [], deps);
  expect(res.answerable).toBe(false);
});
