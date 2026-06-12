// Answer-level eval: runs the full pipeline (retrieve -> generate) and grades each answer
// with an LLM judge for faithfulness + responsiveness. Complements scripts/eval.ts, which
// measures only retrieval hit-rate. Negative cases pass when the system refuses.
//
// Caveat: the judge is the same MiniMax model that writes the answers, so treat the score as
// a self-consistency signal (catches refusals, hallucinations, off-topic replies), not an
// independent oracle. A stronger external judge would need a second provider.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config";
import { loadIndex, DEFAULT_INDEX_DIR } from "../lib/index-store";
import { embed, complete } from "../lib/minimax";
import { retrieve } from "../lib/retrieve";
import { buildMessages } from "../lib/prompt";
import { buildJudgePrompt, parseVerdict } from "../lib/judge";
import { isAnswerLanguageOk, type GoldenCase } from "../lib/eval-core";
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

  let pass = 0;
  let total = 0;
  for (const line of lines) {
    const gc = JSON.parse(line) as GoldenCase;
    const q = gc.question ?? "";
    total++;
    const { chunks, answerable } = await retrieve(q, [], deps);

    if (gc.type === "negative") {
      const ok = !answerable;
      if (ok) pass++;
      console.log(`${ok ? "PASS" : "FAIL"} [negative] ${q}`);
      continue;
    }

    if (!answerable) {
      console.log(`FAIL [answerable] refused: ${q}`);
      continue;
    }

    const { messages } = buildMessages([], q, chunks);
    const answer = await complete(messages, cfg);
    const verdict = parseVerdict(await complete(buildJudgePrompt(q, answer, chunks), cfg));
    const langOk = isAnswerLanguageOk(gc.expectLang, answer);
    const ok = verdict.correct && langOk;
    if (ok) pass++;
    const tag = gc.expectLang ? `answerable, lang=${gc.expectLang}` : "answerable";
    console.log(`${ok ? "PASS" : "FAIL"} [${tag}] ${q}`);
    if (!verdict.correct) console.log(`  reason: ${verdict.reason}`);
    if (!langOk) console.log(`  wrong language: expected ${gc.expectLang}, answer was not`);
  }

  console.log(`\nANSWER ACCURACY ${pass}/${total} (${((pass / total) * 100).toFixed(1)}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
