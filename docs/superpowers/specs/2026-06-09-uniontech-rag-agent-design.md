# UnionTech 3D RAG Chat Agent — Design Spec

**Date:** 2026-06-09
**Status:** Approved (design); pending implementation plan
**Author:** Marcus Liang (with Claude Code)
**Revision:** v2 (incorporates Codex adversarial review round 1)

## 1. Goal

Build a Retrieval-Augmented Generation (RAG) chat agent that knows the content of
<https://www.uniontech3d.com/> and can answer user questions about UnionTech's
products, materials, software, industry applications/solutions, case studies, and
company information. Delivered as a deployable web chat application.

### Success criteria
- A user can open a web page, ask a natural-language question about UnionTech, and
  receive an accurate, **source-cited** answer grounded in the website's content.
- The agent handles both conceptual questions ("can this printer do dental work?")
  and exact spec/model-number questions ("what is the build volume of the RSPro 2100?").
- When the knowledge base does not cover a question, the agent declines instead of
  hallucinating.
- Retrieval quality is measurable via a golden-question eval set (hit-rate +
  citation-correctness report).

## 2. Decisions (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Interface | Web chat app | User wants a browser-based chat for self + others. |
| Stack | Next.js (TypeScript) | Single deployable full-stack app; native to Vercel. |
| Generation model | MiniMax (`MiniMax-M2`, configurable to `MiniMax-M3`) | Cost-efficient; same vendor as embeddings. |
| Embedding model | MiniMax `embo-01` (1536-dim) | One vendor for chat + embeddings; multilingual. |
| Content scope | All sitemap pages + linked PDF datasheets | Detailed specs live in HTML spec tables and downloadable PDFs. |
| Freshness | One-time snapshot, manually re-runnable | Site changes slowly; simplest for v1. |
| Vector store | Local file index committed to repo | Zero infra; corpus is small (single site). |
| Deployment | Vercel | Native Next.js home; cheap. |
| Retrieval | Hybrid (semantic + keyword) + history-aware query rewrite | Best accuracy for spec/model-number queries. |

## 2a. Assumptions to verify before implementation

These are working assumptions gathered during brainstorming. Each must be confirmed
against current primary docs and/or a live API key during the first implementation
phase. They are NOT all independently re-verified facts.

- **Sitemap (mostly verified):** `https://www.uniontech3d.com/sitemap.xml` returned a
  valid sitemap with ~500+ URLs across `/products/`, `/case/`, `/blog/`, company/
  industry news, `_material`, `_software`, `_solutions`, and application articles.
  *To confirm:* whether the top-level file is a **sitemap index** pointing to
  sub-sitemaps; presence of duplicate/archive URLs; `robots.txt` + crawl-delay rules;
  canonical (`rel=canonical`) handling. The crawl is reproducible from the sitemap but
  is **not** assumed clean — see ingestion hardening in §5.1.
- **Chat API (verified shape, model list to confirm):** MiniMax exposes an
  **OpenAI-compatible** chat endpoint at base URL `https://api.minimax.io/v1`. Current
  models are the **M-series** (`MiniMax-M2`, `MiniMax-M3`); `MiniMax-Text-01` is older
  and may not be in the OpenAI-compatible list — do not depend on it. We integrate via
  an **explicit OpenAI-compatible client** (`@ai-sdk/openai-compatible`'s
  `createOpenAICompatible` pointed at this base URL), not a third-party provider whose
  default format may be Anthropic-style.
  Source: <https://platform.minimax.io/docs/api-reference/text-openai-api>.
- **Reasoning output (to handle):** M-series models can emit reasoning/`<think>`
  content in the OpenAI-compatible response. The chat route MUST separate/strip
  reasoning before display and before citation parsing (see §5.4).
- **Embeddings API (legacy shape, to verify with a key):** `embo-01` is **not** part
  of the OpenAI-compatible chat docs above. Per legacy/third-party docs, the endpoint
  is `https://api.minimax.chat/v1/embeddings?GroupId=<id>`, requires a `GroupId`,
  takes a JSON body `{ "model": "embo-01", "texts": [...], "type": "db" | "query" }`,
  supports up to ~4096 tokens per input, and returns **1536-dim** vectors.
  *This is a different host from the chat API* (see §5.6). Verify exact field names,
  batch limits, and host against a live key before building on it.
  Source (legacy): MiniMax embeddings reference (Apifox/legacy console docs).

## 3. Architecture & data flow

Two distinct phases.

**Build time** (offline, `npm run ingest`):
```
sitemap.xml (handle sitemap-index → sub-sitemaps)
  → normalize + dedupe URLs (canonical, drop archives/non-content)
  → respect robots.txt / crawl-delay
  → crawl HTML (extract main content, drop nav/footer; extract spec TABLES structurally)
  → discover + download linked PDFs (table-aware text extraction)
  → content-quality filter (drop empty/boilerplate pages)
  → clean + chunk (heading-aware, ~800 tokens, ~100 overlap; keep spec tables intact)
  → assign stable chunk IDs + doc-type + lastmod metadata
  → embed chunks (embo-01, type:"db", batched ≤4096 tokens/input)
  → write data/index.bin (Float32 vectors) + data/index.meta.json (text + metadata)
```

**Run time** (per chat message):
```
user question + chat history
  → rewrite to standalone query (MiniMax; strip <think>)
  → embed query (embo-01, type:"query")
  → hybrid search (semantic cosine + keyword exact-match), fused with doc-type/recency authority
  → answerability guard (calibrated cosine + exact-match + score-margin, NOT raw RRF score)
  → assemble grounded prompt with per-chunk citation IDs
  → stream answer (MiniMax-M2; strip/separate <think> reasoning)
  → post-generation citation validation (drop/flag citations not in retrieved set)
  → UI renders answer + validated clickable source links
```

The index is committed as a repo asset and loaded once per warm serverless instance
(Node runtime, cached in module scope). Data files MUST be force-included in the
function bundle via `outputFileTracingIncludes` (see §5.2).

## 4. Repository structure

```
/scripts/ingest.ts          # orchestrates crawl → chunk → embed → write index
/lib/crawl.ts               # sitemap(+index) parse, robots, URL normalize/dedupe, HTML + PDF extraction
/lib/extract.ts             # main-content extraction + structured spec-table extraction
/lib/chunk.ts               # heading-aware chunking + metadata + stable chunk IDs
/lib/minimax.ts             # provider adapter: chat() + embed() (isolates BOTH MiniMax hosts/quirks)
/lib/index-store.ts         # load/save index, in-memory cache
/lib/retrieve.ts            # hybrid search: cosine + keyword + authority fusion, query rewriting, guard
/lib/prompt.ts              # system prompt + context assembly with citation IDs
/lib/citations.ts           # citation parsing + post-generation validation
/lib/ratelimit.ts           # server-side rate limiting + request-size + budget guard
/app/api/chat/route.ts      # streaming chat endpoint (Vercel AI SDK)
/app/page.tsx               # chat UI (useChat), citations, example questions
/data/index.bin             # Float32 vectors (committed)
/data/index.meta.json       # chunk text + metadata (committed)
/data/raw/                  # cached crawled pages (gitignored, for resumable re-ingest)
/eval/golden.jsonl          # Q → expected-source-URL(s) + answer-type eval set
```

## 5. Components

### 5.1 Ingestion pipeline (`scripts/ingest.ts`, `lib/crawl.ts`, `lib/extract.ts`, `lib/chunk.ts`)
- **Discover:** fetch `sitemap.xml`; if it is a **sitemap index**, expand sub-sitemaps.
  Build URL list, then **normalize** (strip tracking params, resolve `rel=canonical`,
  enforce single trailing-slash form) and **dedupe**. Filterable by path so sections
  can be included/excluded.
- **Politeness:** read `robots.txt`, honor `Disallow` + crawl-delay; bounded
  concurrency with retry/backoff. Cache raw responses to `/data/raw/` (resumable).
- **HTML extraction (`lib/extract.ts`):** readability-style main-content pass with
  `cheerio` (drop nav/header/footer/cookie banners). **Separately detect spec
  tables** (`<table>` on product pages) and serialize each row as
  `attribute: value` text so numeric specs survive chunking and keyword matching.
- **PDFs:** detect linked `.pdf` datasheets; extract with a **table-aware** approach
  (e.g. `unpdf` for text plus a layout/row-reconstruction pass; fall back to
  `pdf-parse`). Where a PDF mirrors a product page, prefer the HTML table extraction.
- **Content-quality filter:** drop pages with negligible/boilerplate-only text.
- **Chunk:** split on headings; target ~800 tokens with ~100 overlap; keep each spec
  table (or table row group) intact within a single chunk.
- **Metadata per chunk:** `{ chunkId, url, title, docType: product|material|software|solution|case|blog|news|company, sourceType: html-table|html-text|pdf, headingPath, lastmod }`.
  `docType` + `lastmod` drive authority weighting at retrieval time.
- **Embed:** batch chunks through `embo-01` (`type:"db"`), respecting the ~4096-token
  per-input limit and rate limits.
- **Write:** vectors → `index.bin` (Float32), text+metadata → `index.meta.json`.
  Print summary: pages, PDFs, chunks, dropped/duplicate URLs, failures.

### 5.2 Index format & Vercel packaging (`lib/index-store.ts`)
- `index.bin` = packed Float32 vectors (1536 per chunk). `index.meta.json` = aligned
  array of chunk records (text + metadata).
- **Size:** ~500 pages + PDFs ≈ a few thousand chunks. Vectors ≈ 25–40 MB; chunk text
  JSON adds ~15–25 MB → on the order of 40–60 MB total. This is comfortably under
  Vercel's **250 MB uncompressed function bundle limit**, but is large enough that
  cold-start load/parse latency matters (acceptable for v1 low traffic).
- **Packaging (critical):** Vercel Node functions default to **2 GB memory**, but the
  binding constraint is bundle size + file tracing. The `/data/index.*` files MUST be
  force-included via `next.config` `outputFileTracingIncludes` (or read from a bundled
  import); otherwise the deploy succeeds but runtime `fs` reads 404 at the lambda. The
  chat route runs on the **Node.js runtime** (not Edge) so `fs` is available.
- **Migration path** (future): libSQL/Turso or Supabase pgvector if the corpus grows
  materially. Not in v1.

### 5.3 Retrieval (`lib/retrieve.ts`)
1. **Query rewrite:** when chat history exists, MiniMax condenses history + new turn
   into one standalone query (fixes "and its price?" follow-ups). Strip any `<think>`.
2. **Semantic:** embed query (`type:"query"`), cosine similarity vs. all vectors,
   take top-N.
3. **Keyword:** BM25-lite / token-overlap score, with a strong boost for **exact**
   model-name and spec-term matches (e.g. "RSPro 2100", "build volume").
4. **Fusion + authority:** Reciprocal Rank Fusion of semantic + keyword rankings,
   then apply a **doc-type/recency authority weight** so current `product`/spec-table/
   PDF chunks outrank older `blog`/`news` chunks → final top-k (k ≈ 6–8).
5. **Answerability guard (not RRF-based):** decide to answer vs. decline using
   **calibrated raw cosine similarity** of the best chunk, presence of exact
   keyword/model matches, and the **score margin** between top hits — thresholds tuned
   on the eval set. (A fixed threshold on the rank-derived RRF score is explicitly
   rejected as uncalibrated.)

### 5.4 Chat API (`app/api/chat/route.ts`, `lib/prompt.ts`, `lib/citations.ts`)
- `POST` streaming endpoint (Node runtime) via the Vercel AI SDK using
  `createOpenAICompatible` pointed at `https://api.minimax.io/v1`.
- **Reasoning handling:** M-series may emit `<think>` reasoning. The route MUST
  separate reasoning from the user-visible answer (and exclude it from citation
  parsing) before streaming display content.
- **Prompt:** answer **only** from the provided UnionTech context; cite sources using
  required **citation IDs** (e.g. `[c12]`) that map to retrieved chunks; say "I don't
  know" if the context doesn't cover it; never invent specs.
- **Citation validation (`lib/citations.ts`):** after generation, parse emitted
  citation IDs; **drop/flag** any that don't map to a retrieved chunk; map valid IDs to
  their source URLs. Only validated citations are shown. (Claim-level
  "repair/regenerate unsupported sentences" is a documented future enhancement.)

### 5.5 Frontend (`app/page.tsx`)
- Single-page chat using `useChat`: streaming message list, header, a row of example
  questions (e.g. "Compare RSPro 600 and Lite 600", "Which printers suit investment
  casting?"), and per-answer **validated source citations** as clickable links to the
  original uniontech3d.com pages.
- Clean, minimal, responsive. UI polish handled by the frontend-design skill during
  implementation.

### 5.6 Provider abstraction & config (`lib/minimax.ts`)
- Exposes `chat()` and `embed()` so the rest of the app never touches provider
  specifics — keeps DeepSeek swappable later, and isolates the fact that **chat and
  embeddings use different hosts**.
- Env vars:
  - `MINIMAX_API_KEY`
  - `MINIMAX_GROUP_ID` (required by the legacy embeddings endpoint)
  - `MINIMAX_CHAT_BASE_URL` (default `https://api.minimax.io/v1`)
  - `MINIMAX_EMBED_BASE_URL` (default `https://api.minimax.chat/v1`)
  - `CHAT_MODEL` (default `MiniMax-M2`), `EMBED_MODEL` (default `embo-01`)
- `.env.example` committed; real keys never committed. Config validated with `zod`.

### 5.7 Security & abuse controls (`lib/ratelimit.ts`) — IN SCOPE for v1
A public chat backed by paid MiniMax APIs needs basic protection even without user auth:
- **Server-side rate limiting** per IP/session (token-bucket; in-memory for v1, with a
  noted upgrade path to a shared store like Upstash for multi-instance).
- **Request-size limits** (max message length, max history turns).
- **Origin/CORS handling** so the endpoint isn't trivially abused cross-site.
- **Log redaction** (never log API keys; truncate user content).
- **Budget guard:** cap retrieved-context size and max output tokens; surface a
  cost/usage log so spend is observable.

## 6. Error handling
- **Ingest:** retry/backoff, skip-and-log failed/duplicate URLs, resumable from
  `/data/raw/`, robots/rate-limit aware.
- **Runtime:** declined/low-confidence retrieval → graceful "I don't have that
  information"; provider/API errors → friendly user message + redacted logged detail;
  oversized input rejected by the request-size guard.

## 7. Testing & evaluation
- **Unit:** URL normalization/dedupe, sitemap-index expansion, spec-table extraction,
  chunker, cosine + RRF + authority scoring, answerability guard, query rewrite,
  citation parsing/validation, `<think>` stripping.
- **Integration:** ingest a handful of fixture pages (incl. one with a spec table and
  one PDF) → assert chunk count/metadata/table fidelity; retrieval returns the
  expected chunk for known queries.
- **Eval harness (`eval/golden.jsonl`, ~60–100 questions):** categorized as
  (a) per-product spec probes (build volume, wavelength, accuracy, materials),
  (b) application/solution questions, (c) case-study questions,
  (d) model-number alias/variant questions ("RSPro2100" vs "RSPro 2100"),
  (e) **negative/out-of-scope** questions that MUST be declined, and
  (f) comparison questions. Each item lists expected source URL(s). A script reports
  **retrieval hit-rate, refusal correctness, and citation correctness**, serving as
  the objective "knows everything" check and a regression guard for re-crawls.

## 8. Out of scope (v1) / future
User accounts/auth, analytics dashboards, multi-language UI toggle, scheduled
re-crawl/cron, full agentic multi-step retrieval, reranker model, claim-level citation
repair/regeneration, cross-session conversation persistence, migration to a hosted
vector DB, shared/distributed rate-limit store. (Basic abuse controls in §5.7 ARE in
scope.)

## 9. Key dependencies
`next`, `ai` + `@ai-sdk/openai-compatible` (explicit OpenAI-compatible client),
`cheerio` (HTML + spec-table extraction), `unpdf` (fallback `pdf-parse`) with a
table-aware extraction pass, `fast-xml-parser` (sitemap + sitemap-index),
`robots-parser` (robots.txt), `tsx` (run scripts), `vitest` (tests),
`zod` (config validation).
