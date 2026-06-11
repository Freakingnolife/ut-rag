# Working in this repo

Read this before you touch anything. The rules below are not aspirational — follow them.

- **Think before coding.** State your assumptions. If a task has more than one valid reading, surface it — don't silently pick one and build it.
- **Ask, don't guess.** When something is unclear, stop and ask. A wrong guess that compiles costs more than a question.
- **Minimum code, no premature abstraction.** Write the least code that solves the problem. No speculative features, no flexibility nobody asked for, no abstraction for single-use code. If the diff could be half the size, make it half the size.
- **Surgical changes only.** Touch only what the task requires. Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken. Every changed line traces to the task.
- **Readable over clever.** Boring, obvious code wins. Match the style of the file you're editing. Optimize for the next reader.

## What this is

UnionTech 3D RAG chat agent — answers questions about uniontech3d.com using hybrid RAG (vector + keyword) over a **local, committed** vector index. MiniMax provides chat + embeddings. Next.js 16, deployed on Vercel.

## The pipeline

Data flows in one direction; each stage owns one `lib/` file. Find the stage, edit the file.

| Stage | File |
|---|---|
| Crawl sitemap + fetch pages | `lib/crawl.ts`, `lib/sitemap.ts`, `lib/robots.ts` |
| Extract text (HTML / PDF) | `lib/extract.ts`, `lib/pdf.ts` |
| Chunk | `lib/chunk.ts` |
| Embed + vector math | `lib/minimax.ts`, `lib/vector.ts` |
| Build / load index | `lib/index-store.ts` |
| Retrieve (vector) | `lib/retrieve.ts` |
| Keyword + fuse the two | `lib/keyword.ts`, `lib/fuse.ts` |
| Answer + cite | `lib/chat-core.ts`, `lib/citations.ts`, `lib/prompt.ts` |

The chat route `app/api/chat/route.ts` wires this together at request time. `scripts/ingest.ts` runs the build-time half (crawl → embed → write index).

## Conventions

- **Every `lib/` module pairs with a `lib/<name>.test.ts`.** This is the existing discipline — keep it. New behavior gets a failing test *first*, then code to make it pass. Run with `npm test` (vitest).
- **To investigate behavior, write a failing test, not a one-off script.** A test that pins the behavior is worth more than a `debug_*.ts` you throw away (see Scratch scripts below for when a script is genuinely warranted).
- **One module, one job.** If a file grows past a single clear purpose, that's the signal to split it — not to keep piling on.

## Scratch scripts

Debug scripts are fine *while diagnosing*. Convention:

- They live in `scripts/` as `debug_*.ts`, `check_*.ts`, or `eval_debug.ts`.
- These globs are **excluded from type-checking** in `tsconfig.json` — that's deliberate, so a scratch script with loose types doesn't break `tsc`.
- Delete them (or leave them uncommitted) once the question is answered. Don't let them accumulate, and don't commit them as if they were features.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Local dev server → http://localhost:3000 |
| `npm test` | Run the vitest suite |
| `npm run ingest` | Rebuild the index: `data/index.bin` + `data/index.meta.json` (commit the result) |
| `npm run eval` | Run the golden retrieval set in `eval/golden.jsonl` (hit-rate + refusal correctness) |

`tsx` scripts (`ingest`, `eval`) need `.env.local` sourced to see `MINIMAX_API_KEY` — they won't pick it up otherwise.

## Deploy & runtime gotchas

- **Secrets via env:** `MINIMAX_API_KEY` (required), `MINIMAX_GROUP_ID` (optional), plus base URLs / model ids in `.env.example`. Never hardcode keys.
- **The committed `data/` index is force-included** for the chat route via `outputFileTracingIncludes` in `next.config.ts`. If you move or rename the index files, update that config or the deployed route can't read them.
- **The chat route runs on the Node.js runtime** (it reads the index from disk) — not edge.
- **Rebuilding the index = re-run `npm run ingest` and commit** the new `data/` files. The index is part of the repo, not generated at deploy.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
