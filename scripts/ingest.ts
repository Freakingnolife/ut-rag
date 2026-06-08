import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { fetchWithRetry, isPdfUrl } from "../lib/crawl";
import { parseSitemap } from "../lib/sitemap";
import { makeRobots } from "../lib/robots";
import { dedupeUrls, normalizeUrl } from "../lib/urls";
import { htmlToRawDoc, assignChunkIds } from "../lib/pipeline";
import { buildChunks } from "../lib/chunk";
import { pdfToText } from "../lib/pdf";
import { classifyDocType } from "../lib/extract";
import { embed } from "../lib/minimax";
import { saveIndex } from "../lib/index-store";
import type { Chunk, RawDoc } from "../lib/types";

const SITE = "https://www.uniontech3d.com";
const DATA_DIR = join(process.cwd(), "data");
const RAW_DIR = join(DATA_DIR, "raw");
const RETRY = { retries: 3, baseDelayMs: 500 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cachePath(url: string): string {
  return join(RAW_DIR, encodeURIComponent(url));
}

async function getCached(url: string, isBinary: boolean): Promise<Buffer | string> {
  const p = cachePath(url);
  if (existsSync(p)) return isBinary ? readFileSync(p) : readFileSync(p, "utf8");
  const res = await fetchWithRetry(url, RETRY);
  if (isBinary) {
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(p, buf);
    return buf;
  }
  const text = await res.text();
  writeFileSync(p, text);
  return text;
}

async function expandSitemap(url: string): Promise<{ url: string; lastmod: string | null }[]> {
  const xml = (await getCached(url, false)) as string;
  const parsed = parseSitemap(xml);
  if (!parsed.isIndex) return parsed.entries;
  const all: { url: string; lastmod: string | null }[] = [];
  for (const sm of parsed.sitemaps) all.push(...(await expandSitemap(sm)));
  return all;
}

async function main() {
  const cfg = loadConfig();
  mkdirSync(RAW_DIR, { recursive: true });

  const robotsBody = (await getCached(`${SITE}/robots.txt`, false).catch(() => "")) as string;
  const robots = makeRobots(`${SITE}/robots.txt`, robotsBody);
  const delayMs = (robots.crawlDelay() || 1) * 1000;

  const entries = await expandSitemap(`${SITE}/sitemap.xml`);
  const urls = dedupeUrls(entries.map((e) => e.url)).filter((u) => robots.allowed(u));
  const lastmodByUrl = new Map(entries.map((e) => [normalizeUrl(e.url), e.lastmod]));
  console.log(`Discovered ${urls.length} URLs`);

  const docs: RawDoc[] = [];
  let failures = 0;
  for (const url of urls) {
    try {
      const lastmod = lastmodByUrl.get(url) ?? null;
      if (isPdfUrl(url)) {
        const buf = (await getCached(url, true)) as Buffer;
        const text = await pdfToText(new Uint8Array(buf));
        if (text.trim().length > 50) {
          docs.push({ url, title: url.split("/").pop() ?? url, docType: classifyDocType(url), lastmod, sourceType: "pdf", mainText: text, specTables: [] });
        }
      } else {
        const html = (await getCached(url, false)) as string;
        const doc = htmlToRawDoc(url, html, lastmod);
        if (doc.mainText.trim().length > 50 || doc.specTables.length) docs.push(doc);
      }
    } catch (e) {
      failures++;
      console.warn(`SKIP ${url}: ${String(e)}`);
    }
    await sleep(delayMs);
  }

  let chunks: Chunk[] = [];
  for (const doc of docs) chunks.push(...buildChunks(doc));
  chunks = assignChunkIds(chunks);
  console.log(`Built ${chunks.length} chunks from ${docs.length} docs`);

  const vectors: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map((c) => c.text.slice(0, 12000));
    vectors.push(...(await embed(batch, "db", cfg)));
    console.log(`Embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
    await sleep(200);
  }

  await saveIndex(DATA_DIR, chunks, vectors);
  console.log(`Wrote index: ${chunks.length} chunks, ${failures} failures`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
