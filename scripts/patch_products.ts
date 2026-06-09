/**
 * Re-embeds only product pages with improved chunk text (title-prefixed spec tables).
 * Uses existing raw HTML cache — no network crawling needed.
 * Writes an updated index replacing product chunks with new embeddings.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { loadIndex, DEFAULT_INDEX_DIR, saveIndex } from "../lib/index-store";
import { htmlToRawDoc } from "../lib/pipeline";
import { buildChunks } from "../lib/chunk";
import { embed } from "../lib/minimax";
import type { Chunk } from "../lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const RAW_DIR = join(process.cwd(), "data", "raw");

  const productUrls = [...new Set(idx.records.filter((r) => r.url.includes("/products/")).map((r) => r.url))];
  console.log(`Re-embedding ${productUrls.length} product pages...`);

  // Build new chunks for product pages using improved chunk.ts (title-prefixed spec tables)
  const newChunks: Chunk[] = [];
  for (const url of productUrls) {
    const cached = join(RAW_DIR, encodeURIComponent(url));
    try {
      const html = readFileSync(cached, "utf8");
      const doc = htmlToRawDoc(url, html, null);
      const chunks = buildChunks(doc);
      newChunks.push(...chunks);
      console.log(`  ${url.replace("https://www.uniontech3d.com/", "")} → ${chunks.length} chunks`);
    } catch (e) {
      console.warn(`  SKIP ${url}: ${e}`);
    }
  }

  // Embed new product chunks
  console.log(`\nEmbedding ${newChunks.length} new product chunks...`);
  const newVectors: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < newChunks.length; i += BATCH) {
    const batch = newChunks.slice(i, i + BATCH).map((c) => c.text.slice(0, 12000));
    newVectors.push(...(await embed(batch, "db", cfg)));
    console.log(`  Embedded ${Math.min(i + BATCH, newChunks.length)}/${newChunks.length}`);
    await sleep(200);
  }

  // Replace product chunks in the existing index
  const nonProductChunks = idx.records.filter((r) => !r.url.includes("/products/"));
  const nonProductVectors: number[][] = [];
  for (let i = 0; i < idx.records.length; i++) {
    if (!idx.records[i].url.includes("/products/")) {
      const offset = i * idx.dim;
      nonProductVectors.push(Array.from(idx.matrix.slice(offset, offset + idx.dim)));
    }
  }

  const allChunks = [...nonProductChunks, ...newChunks];
  const allVectors = [...nonProductVectors, ...newVectors];
  const DATA_DIR = join(process.cwd(), "data");
  await saveIndex(DATA_DIR, allChunks, allVectors);
  console.log(`\nPatched index: ${nonProductChunks.length} unchanged + ${newChunks.length} product chunks = ${allChunks.length} total`);
}

main().catch((e) => { console.error(e); process.exit(1); });
