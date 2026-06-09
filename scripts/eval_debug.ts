import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { loadIndex, DEFAULT_INDEX_DIR } from "../lib/index-store";
import { embed, complete } from "../lib/minimax";
import { retrieve } from "../lib/retrieve";
import { scoreCase, isHit, type GoldenCase } from "../lib/eval-core";
import type { ChatMessage } from "../lib/types";

async function main() {
  const cfg = loadConfig();
  const index = loadIndex(DEFAULT_INDEX_DIR);
  const lines = readFileSync(join(process.cwd(), "eval", "golden.jsonl"), "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  const deps = {
    index,
    embedQuery: async (q: string) => (await embed([q], "query", cfg))[0],
    complete: (m: ChatMessage[]) => complete(m, cfg),
    nowIso: new Date().toISOString(),
  };

  for (const line of lines) {
    const gc = JSON.parse(line) as GoldenCase;
    if (gc.type !== "answerable") continue;
    const out = await retrieve(gc.question ?? "", [], deps);
    const hit = isHit(gc.expectedUrls, out.chunks);
    const pass = out.answerable && hit;
    if (!pass) {
      const cosines = out.chunks.slice(0, 3).map(c => c.cosine.toFixed(2));
      const urlHit = hit ? 'URL_HIT' : 'URL_MISS';
      const ansHit = out.answerable ? 'ANSWERABLE' : 'NOT_ANSWERABLE';
      console.log(`${urlHit}/${ansHit} [cos:${cosines}] ${gc.question}`);
      if (!hit) {
        const top8urls = out.chunks.map(c => c.url.replace('https://www.uniontech3d.com/', ''));
        console.log('  top8:', top8urls.join(', '));
        console.log('  expected:', gc.expectedUrls.map(u => u.replace('https://www.uniontech3d.com/', '')).join(', '));
      }
    }
  }
}
main().catch(console.error);
