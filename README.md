# UnionTech 3D RAG Chat Agent

Web chat agent that answers questions about uniontech3d.com using hybrid RAG
(MiniMax chat + embeddings, local vector index).

## Setup
1. `cp .env.example .env.local` and fill in `MINIMAX_API_KEY` and optionally `MINIMAX_GROUP_ID`.
2. `npm install`

## Build the index (one-time / on refresh)
`npm run ingest` — crawls the sitemap, extracts pages + PDFs, embeds chunks, and
writes `data/index.bin` + `data/index.meta.json` (committed to the repo).

## Evaluate retrieval
`npm run eval` — runs `eval/golden.jsonl` and prints hit-rate + refusal correctness.

## Run locally
`npm run dev` then open http://localhost:3000

## Test
`npm test`

## Deploy (Vercel)
Push to a Vercel-connected repo. The chat route runs on the Node.js runtime and the
`data/` index is force-included via `outputFileTracingIncludes` in `next.config.ts`.
Set `MINIMAX_API_KEY` (and optionally `MINIMAX_GROUP_ID`) in Vercel project env vars.
