import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { loadIndex, DEFAULT_INDEX_DIR } from "../lib/index-store";
import { embed, complete } from "../lib/minimax";
import { retrieve } from "../lib/retrieve";
import { scoreCase, summarize, type GoldenCase } from "../lib/eval-core";
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

  const results: { pass: boolean }[] = [];
  for (const line of lines) {
    const gc = JSON.parse(line) as GoldenCase;
    const out = await retrieve(gc.question ?? "", [], deps);
    const r = scoreCase(gc, { answerable: out.answerable, chunks: out.chunks });
    results.push(r);
    if (!r.pass) {
      console.log(`FAIL [${gc.type}] ${gc.question}`);
      console.log(`  got: answerable=${out.answerable}, top=${out.chunks.slice(0, 3).map((c) => c.url).join(", ")}`);
    }
  }

  const s = summarize(results);
  console.log(`\nPASS ${s.passed}/${s.total} (${(s.rate * 100).toFixed(1)}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
