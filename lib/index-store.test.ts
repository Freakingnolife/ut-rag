import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveIndex, loadIndex, _clearCache } from "./index-store";
import type { Chunk } from "./types";

const dirs: string[] = [];
function tempDir() {
  const d = mkdtempSync(join(tmpdir(), "idx-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  _clearCache();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "t0", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "a" },
  { chunkId: "c1", url: "u1", title: "t1", docType: "blog", sourceType: "html-text", headingPath: [], lastmod: null, text: "b" },
];

test("save then load round-trips records and normalizes vectors to unit length", async () => {
  const dir = tempDir();
  await saveIndex(dir, records, [[3, 4], [0, 5]]); // norms 5 and 5
  const idx = loadIndex(dir);
  expect(idx.dim).toBe(2);
  expect(idx.records).toHaveLength(2);
  // first vector normalized: [0.6, 0.8]
  expect(idx.matrix[0]).toBeCloseTo(0.6, 5);
  expect(idx.matrix[1]).toBeCloseTo(0.8, 5);
});
