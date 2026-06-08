import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Chunk, LoadedIndex } from "./types";

const META = "index.meta.json";
const BIN = "index.bin";

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export async function saveIndex(dir: string, records: Chunk[], vectors: number[][]): Promise<void> {
  if (records.length !== vectors.length) {
    throw new Error("saveIndex: records and vectors length mismatch");
  }
  if (records.length > 0 && !vectors[0]?.length) {
    throw new Error("saveIndex: vectors array contains empty vectors");
  }
  const dim = vectors[0]?.length ?? 0;
  const flat = new Float32Array(records.length * dim);
  vectors.forEach((v, i) => {
    const nv = normalize(v);
    flat.set(nv, i * dim);
  });
  writeFileSync(join(dir, META), JSON.stringify({ dim, count: records.length, records }));
  writeFileSync(join(dir, BIN), Buffer.from(flat.buffer));
}

const cache = new Map<string, LoadedIndex>();
export function _clearCache(): void {
  cache.clear();
}

export function loadIndex(dir: string): LoadedIndex {
  const cached = cache.get(dir);
  if (cached) return cached;
  const meta = JSON.parse(readFileSync(join(dir, META), "utf8")) as {
    dim: number;
    records: Chunk[];
  };
  const buf = readFileSync(join(dir, BIN));
  const matrix = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const loaded: LoadedIndex = { dim: meta.dim, records: meta.records, matrix };
  cache.set(dir, loaded);
  return loaded;
}

export const DEFAULT_INDEX_DIR = join(process.cwd(), "data");
