# Demo hardening — findings & decisions (2026-06-13)

Pre-demo pass to answer one question: *how accurate and fast is the system, really, and what can we safely improve in 24h?* This records what we measured, what we changed, and — importantly — what we deliberately chose **not** to change before the demo.

## Baseline (measured, not estimated)

| Metric | Value | How measured |
|---|---|---|
| Retrieval hit-rate | 74.4% (29/39) | `npm run eval` (golden set) |
| Answer accuracy | *no metric existed* | — |
| Retrieval latency | avg 517ms, p95 702ms | embed query + local fuse; **excludes** answer generation |
| Answer generation | ~2.0s for a 2-sentence answer | MiniMax chat completion |
| Multi-turn | +1.5–2s before retrieval | a full LLM query-rewrite ran on **every** follow-up |

**The 0.5s target is architecturally impossible** with an LLM in the loop. Honest number: first streamed word in ~1–1.5s, full answer 2–3s. We stream, so it *feels* responsive. The eval's "latency" is retrieval-only and was being read as end-to-end — it isn't.

**74% is retrieval hit-rate, not answer quality.** It measures whether the exact golden URL lands in the top-8 chunks, plus refusal correctness. It says nothing about whether the generated answer is right.

## What shipped

| Commit | Change | Why |
|---|---|---|
| `9a406da` | **Spec-page retrieval fix** | Model-number queries ("RSPro 2100 build volume", "RS Pro 2100 specs") returned news/marketing pages. embo-01 drops the catalog page out of the semantic top-N, leaving it on one weak keyword-RRF contribution that two-list news/case pages outscore. Fix: 4× boost for a **product** page whose **URL slug** carries the queried model number (canonical — survives CMS-generic `<title>` tags and isn't fooled by comparison tables that mention the model in body text), plus an answerability clause so a boosted-but-cold-cosine page isn't then refused. |
| `21d2606` | **Rewrite shortcut for follow-ups** | The query-rewrite was a full LLM round-trip on every follow-up. `needsContext()` now gates it: only anaphoric ("does it…"), continuation ("and the Lite 600?"), or fragment ("specs?") questions pay the cost. Standalone follow-ups skip it and save ~1.5–2s. CJK/empty falls through to rewrite (safe default). |
| `8f4facf` | **Answer-level LLM-judge eval** (`npm run eval:answers`) | Existing eval only sees retrieval. This runs the full pipeline (retrieve → generate) and grades each answer for faithfulness + responsiveness; negatives pass on refusal. Gives a real answer-accuracy number **and** a punch-list of answer bugs retrieval can't see. Caveat: judge is the same MiniMax model (self-consistency signal, not an independent oracle). |
| `0eb720e` | **UX: typing indicator + curated chips** | Static `…` replaced with three pulsing dots (`role=status`, `aria-label`, respects `prefers-reduced-motion`) so the ~1s first-token wait reads as working. Example chips swapped to known-good questions — "investment casting" (judge flagged the answer evasive) and "Compare RSPro 600 and Lite 600" (returns a refusal) replaced with the SLA-models and dental questions, both of which pass the answer eval. Verified via Playwright. |

## Result

| Metric | Before | After |
|---|---|---|
| Retrieval hit-rate | 74.4% (29/39) | **82.1% (32/39)** |
| Answer accuracy | — | **84.6% (33/39)** |
| Unit tests | 89 | **94, all passing** |
| Multi-turn latency | rewrite every turn | **~1.5–2s saved on standalone follow-ups** |

Answer accuracy (85%) exceeds retrieval hit-rate (82%) on purpose: the LLM often answers correctly from related chunks even when the *exact* golden URL isn't top-8.

### Answer bugs the judge surfaced (avoid on stage / fix later)
- **AME RD3000** — mixes up specs with its sibling model **R3000** (shared "3000" token; both pages retrieved, answer blends them).
- **Resin compatibility** — claimed a DLP-only material works on SLA (hallucination).
- **Chinese honors/certifications** — invented awards not in the retrieved context.
- **π663 build volume** — refuses (the `.cn` product page never surfaces).
- **"wats the biggest printer…"** — refuses (slang, no model number to anchor on).

## Decision: Chinese retrieval is **deferred**, not fixed

**We chose not to fix the Chinese spec failures before the demo.** This was deliberate.

### Root cause (diagnosed, confirmed)
Not tokenization — the CJK bigram code in `lib/keyword.ts` works. Two structural issues:
1. The `.cn` model pages (`show-pi663-sla.html`, `show-ame-rd3000.html`) are classified **`docType: solution`, not `product`**, because `classifyDocType` keys off `/products/` in the URL and the `.cn` site uses a `show-<slug>.html` scheme shared with articles. So the product-only spec boost can't lift them.
2. Fixing `classifyDocType` **requires rebuilding the committed index** (`npm run ingest` — full re-crawl + re-embed of ~2,000 chunks). docType is baked into `data/index.meta.json` at ingest time.

### Why deferred
- **Risk is asymmetric.** Upside: recover ~2 narrow Chinese spec questions. Downside: a re-crawl can shift content / hit 404s, regenerates all embeddings, and rewrites the committed index wholesale — any of which can regress the now-solid English path the day before a demo. Bad trade.
- **Chinese already works where it counts.** Answer-eval confirms correct answers for HQ, founding year, mission, SLA lineup, industry solutions, and dental. The failures are deep numeric spec lookups.
- **The real fix isn't quick.** Classifier change (the `.cn` URL scheme doesn't cleanly separate product from article pages) + RD3000/R3000 numeric disambiguation + rebuild + re-run both evals to confirm no regression.
- **The one no-rebuild shortcut was tested and rejected.** Extending the spec boost to `solution` docType recovered π663/RD3000/SLA-models but **regressed three common English questions** (metal printers, install count, software) — `"3D"` tokenizes to a digit-bearing `3d` token matching nearly every `.cn` URL slug. Net zero, traded the wrong way. Reverted.

### Demo-day guidance (Chinese)
- **Strong**: company facts, product lineup, applications, dental, founding/HQ.
- **Avoid on stage**: deep numeric spec questions for a *specific* model in Chinese (π663 build volume, RD3000 specs). If asked live, the system hedges or refuses — safer than confidently wrong.

### Post-demo plan (the proper fix, done calmly with verification)
1. Fix `classifyDocType` so `.cn` model pages classify as `product`.
2. Add RD3000-vs-R3000 numeric disambiguation (prefer the most-specific model token; avoid bare-number collisions).
3. Handle the `3d` over-match before widening any boost beyond `docType: product`.
4. `npm run ingest`, commit the new `data/`.
5. Gate the merge on **both** evals not regressing (`npm run eval` and `npm run eval:answers`).

## How to re-measure
```bash
npm test               # 94 unit tests
npm run eval           # retrieval hit-rate (golden set)
npm run eval:answers   # answer accuracy via LLM judge
```
All three need `.env.local` sourced for `MINIMAX_API_KEY`.
