# UnionTech 3D RAG Chat Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web chat app that answers questions about uniontech3d.com using hybrid RAG over a locally-built, committed vector index, with MiniMax for chat + embeddings.

**Architecture:** An offline ingestion script crawls the sitemap, extracts page text + spec tables + PDFs, chunks and embeds them (MiniMax `embo-01`), and writes a local vector index (`data/index.bin` + `data/index.meta.json`). At runtime, a Node-runtime API route rewrites the query, runs hybrid retrieval (cosine + keyword, fused with doc-type/recency authority), guards answerability, builds a citation-ID prompt, streams a MiniMax-M2 answer, and validates citations. A thin Next.js UI renders streamed answers with clickable sources.

**Tech Stack:** Next.js (App Router, TypeScript), Vercel AI SDK + `@ai-sdk/openai-compatible`, `cheerio`, `unpdf`, `fast-xml-parser`, `robots-parser`, `zod`, `vitest`, `tsx`.

**Spec:** `docs/superpowers/specs/2026-06-09-uniontech-rag-agent-design.md`

---

## Conventions (read once)

- **Test runner:** `vitest`. Test files live next to source as `*.test.ts`. Run a single file with `npx vitest run <path>`; run all with `npx vitest run`.
- **Determinism:** pure functions that need "now" take an ISO string / ms argument — never call `Date.now()` inside them, so tests are stable.
- **Network:** every function that calls `fetch` takes an injectable `fetchImpl = fetch` last arg so tests pass a fake. Never hit the real network in unit tests.
- **Commits:** after each task's tests pass. Conventional commit messages (`feat:`, `test:`, `chore:`).
- **Shared types** live in `lib/types.ts` (Task 1) and are imported everywhere — do not redefine them.

---

## Task 0: Scaffold the Next.js + TypeScript + Vitest project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.env.example`, `app/layout.tsx`, `app/page.tsx` (placeholder), `.gitignore` (already exists — verify)

- [ ] **Step 1: Create the Next.js app non-interactively**

Run:
```bash
npx create-next-app@latest . --ts --app --no-tailwind --no-src-dir --no-eslint --import-alias "@/*" --use-npm --yes
```
Expected: project files created in the current directory (the existing `docs/` and `.git/` are preserved).

- [ ] **Step 2: Install runtime + dev dependencies**

Run:
```bash
npm install ai @ai-sdk/openai-compatible cheerio unpdf fast-xml-parser robots-parser zod
npm install -D vitest tsx @types/node
```
Expected: dependencies added, no errors.

- [ ] **Step 3: Add scripts and vitest config**

Edit `package.json` `"scripts"` to include:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "ingest": "tsx scripts/ingest.ts",
    "eval": "tsx scripts/eval.ts"
  }
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `.env.example`**

Create `.env.example`:
```bash
MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_CHAT_BASE_URL=https://api.minimax.io/v1
MINIMAX_EMBED_BASE_URL=https://api.minimax.chat/v1
CHAT_MODEL=MiniMax-M2
EMBED_MODEL=embo-01
```

- [ ] **Step 5: Verify build tooling runs**

Run: `npx vitest run`
Expected: "No test files found" (exit 0) — confirms vitest is wired. (If it exits non-zero on no-tests, that's fine; the next task adds the first test.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + vitest project"
```

---

## Task 1: Shared types

**Files:**
- Create: `lib/types.ts`
- Test: `lib/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/types.test.ts
import { expect, test } from "vitest";
import type { Chunk, DocType, SourceType } from "./types";
import { DOC_TYPES } from "./types";

test("DOC_TYPES contains all known document types", () => {
  const expected: DocType[] = [
    "product", "material", "software", "solution",
    "case", "blog", "news", "company",
  ];
  expect([...DOC_TYPES].sort()).toEqual([...expected].sort());
});

test("a Chunk shape is assignable", () => {
  const c: Chunk = {
    chunkId: "c0",
    url: "https://www.uniontech3d.com/products/rspro-2100.html",
    title: "RSPro 2100",
    docType: "product",
    sourceType: "html-table" as SourceType,
    headingPath: ["Specifications"],
    lastmod: null,
    text: "build volume: 600 x 600 x 400 mm",
  };
  expect(c.chunkId).toBe("c0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/types.test.ts`
Expected: FAIL ("Cannot find module './types'").

- [ ] **Step 3: Write the types**

```ts
// lib/types.ts
export const DOC_TYPES = [
  "product", "material", "software", "solution",
  "case", "blog", "news", "company",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type SourceType = "html-text" | "html-table" | "pdf";

export interface ChunkMeta {
  chunkId: string;
  url: string;
  title: string;
  docType: DocType;
  sourceType: SourceType;
  headingPath: string[];
  lastmod: string | null;
}

export interface Chunk extends ChunkMeta {
  text: string;
}

export interface RetrievedChunk extends Chunk {
  cosine: number;
  keyword: number;
  score: number;
}

export interface SpecTable {
  caption: string;
  rows: string[];
}

export interface RawDoc {
  url: string;
  title: string;
  docType: DocType;
  lastmod: string | null;
  sourceType: "html-text" | "pdf";
  mainText: string;
  specTables: SpecTable[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LoadedIndex {
  dim: number;
  records: Chunk[];
  matrix: Float32Array; // records.length * dim, row-major, L2-normalized
}

export interface SourceRef {
  n: number; // 1-based citation label shown to the model
  url: string;
  title: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/types.test.ts
git commit -m "feat: shared domain types"
```

---

## Task 2: Config loader (zod)

**Files:**
- Create: `lib/config.ts`
- Test: `lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/config.test.ts
import { expect, test } from "vitest";
import { loadConfig } from "./config";

const full = {
  MINIMAX_API_KEY: "key",
  MINIMAX_GROUP_ID: "group",
};

test("applies defaults for base URLs and models", () => {
  const cfg = loadConfig(full);
  expect(cfg.MINIMAX_CHAT_BASE_URL).toBe("https://api.minimax.io/v1");
  expect(cfg.MINIMAX_EMBED_BASE_URL).toBe("https://api.minimax.chat/v1");
  expect(cfg.CHAT_MODEL).toBe("MiniMax-M2");
  expect(cfg.EMBED_MODEL).toBe("embo-01");
});

test("throws when required key is missing", () => {
  expect(() => loadConfig({ MINIMAX_GROUP_ID: "group" })).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/config.test.ts`
Expected: FAIL ("Cannot find module './config'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/config.ts
import { z } from "zod";

const EnvSchema = z.object({
  MINIMAX_API_KEY: z.string().min(1),
  MINIMAX_GROUP_ID: z.string().min(1),
  MINIMAX_CHAT_BASE_URL: z.string().url().default("https://api.minimax.io/v1"),
  MINIMAX_EMBED_BASE_URL: z.string().url().default("https://api.minimax.chat/v1"),
  CHAT_MODEL: z.string().min(1).default("MiniMax-M2"),
  EMBED_MODEL: z.string().min(1).default("embo-01"),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return EnvSchema.parse(env);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/config.ts lib/config.test.ts
git commit -m "feat: zod-validated config loader"
```

---

## Task 3: MiniMax adapter — reasoning stripper + embeddings + completion

**Files:**
- Create: `lib/minimax.ts`
- Test: `lib/minimax.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/minimax.test.ts
import { expect, test } from "vitest";
import { stripReasoning, embed, complete } from "./minimax";
import type { Config } from "./config";

const cfg: Config = {
  MINIMAX_API_KEY: "key",
  MINIMAX_GROUP_ID: "group",
  MINIMAX_CHAT_BASE_URL: "https://chat.example/v1",
  MINIMAX_EMBED_BASE_URL: "https://embed.example/v1",
  CHAT_MODEL: "MiniMax-M2",
  EMBED_MODEL: "embo-01",
};

test("stripReasoning removes <think> blocks", () => {
  expect(stripReasoning("<think>reason</think>Hello")).toBe("Hello");
  expect(stripReasoning("plain")).toBe("plain");
  expect(stripReasoning("<think>a\nb</think>\nAnswer")).toBe("Answer");
});

test("embed posts to embed host with GroupId and returns vectors", async () => {
  let captured: { url: string; body: any } | null = null;
  const fakeFetch = async (url: string, init: any) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ vectors: [[0.1, 0.2]] }), { status: 200 });
  };
  const out = await embed(["hi"], "query", cfg, fakeFetch as any);
  expect(out).toEqual([[0.1, 0.2]]);
  expect(captured!.url).toBe("https://embed.example/v1/embeddings?GroupId=group");
  expect(captured!.body).toEqual({ model: "embo-01", texts: ["hi"], type: "query" });
});

test("embed throws on non-ok", async () => {
  const fakeFetch = async () => new Response("nope", { status: 500 });
  await expect(embed(["hi"], "db", cfg, fakeFetch as any)).rejects.toThrow();
});

test("complete posts to chat host and strips reasoning", async () => {
  const fakeFetch = async (url: string) => {
    expect(url).toBe("https://chat.example/v1/chat/completions");
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "<think>x</think>Done" } }] }),
      { status: 200 },
    );
  };
  const out = await complete([{ role: "user", content: "q" }], cfg, fakeFetch as any);
  expect(out).toBe("Done");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/minimax.test.ts`
Expected: FAIL ("Cannot find module './minimax'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/minimax.ts
import type { Config } from "./config";
import type { ChatMessage } from "./types";

export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
}

export async function embed(
  texts: string[],
  kind: "db" | "query",
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][]> {
  const url = `${cfg.MINIMAX_EMBED_BASE_URL}/embeddings?GroupId=${encodeURIComponent(cfg.MINIMAX_GROUP_ID)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({ model: cfg.EMBED_MODEL, texts, type: kind }),
  });
  if (!res.ok) throw new Error(`MiniMax embeddings error: ${res.status}`);
  const data = (await res.json()) as { vectors?: number[][] };
  if (!data.vectors) throw new Error("MiniMax embeddings: response missing 'vectors'");
  return data.vectors;
}

export async function complete(
  messages: ChatMessage[],
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(`${cfg.MINIMAX_CHAT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({ model: cfg.CHAT_MODEL, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`MiniMax chat error: ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return stripReasoning(data.choices?.[0]?.message?.content ?? "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/minimax.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/minimax.ts lib/minimax.test.ts
git commit -m "feat: MiniMax adapter (embed, complete, reasoning strip)"
```

---

## Task 4: URL normalization + dedupe

**Files:**
- Create: `lib/urls.ts`
- Test: `lib/urls.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/urls.test.ts
import { expect, test } from "vitest";
import { normalizeUrl, dedupeUrls } from "./urls";

test("strips hash and tracking params", () => {
  expect(normalizeUrl("https://x.com/a?utm_source=g&id=2#top"))
    .toBe("https://x.com/a?id=2");
});

test("removes trailing slash except root", () => {
  expect(normalizeUrl("https://x.com/a/")).toBe("https://x.com/a");
  expect(normalizeUrl("https://x.com/")).toBe("https://x.com/");
});

test("dedupeUrls collapses equivalent URLs", () => {
  const out = dedupeUrls([
    "https://x.com/a/",
    "https://x.com/a?utm_medium=email",
    "https://x.com/b",
  ]);
  expect(out.sort()).toEqual(["https://x.com/a", "https://x.com/b"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/urls.test.ts`
Expected: FAIL ("Cannot find module './urls'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/urls.ts
const TRACKING = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "ref",
];

export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  for (const k of TRACKING) u.searchParams.delete(k);
  const qs = u.searchParams.toString();
  u.search = qs ? `?${qs}` : "";
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

export function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.map(normalizeUrl))];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/urls.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/urls.ts lib/urls.test.ts
git commit -m "feat: URL normalization and dedupe"
```

---

## Task 5: Sitemap + sitemap-index parsing

**Files:**
- Create: `lib/sitemap.ts`
- Test: `lib/sitemap.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/sitemap.test.ts
import { expect, test } from "vitest";
import { parseSitemap } from "./sitemap";

const urlset = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.com/a</loc><lastmod>2025-01-02</lastmod></url>
  <url><loc>https://x.com/b</loc></url>
</urlset>`;

const index = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://x.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://x.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;

test("parses a urlset into entries", () => {
  const r = parseSitemap(urlset);
  expect(r.isIndex).toBe(false);
  expect(r.entries).toEqual([
    { url: "https://x.com/a", lastmod: "2025-01-02" },
    { url: "https://x.com/b", lastmod: null },
  ]);
});

test("parses a sitemap index into child sitemap URLs", () => {
  const r = parseSitemap(index);
  expect(r.isIndex).toBe(true);
  expect(r.sitemaps).toEqual([
    "https://x.com/sitemap-1.xml",
    "https://x.com/sitemap-2.xml",
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sitemap.test.ts`
Expected: FAIL ("Cannot find module './sitemap'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/sitemap.ts
import { XMLParser } from "fast-xml-parser";

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

export interface ParsedSitemap {
  isIndex: boolean;
  entries: SitemapEntry[];
  sitemaps: string[];
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function parseSitemap(xml: string): ParsedSitemap {
  const parser = new XMLParser({ ignoreAttributes: true });
  const doc = parser.parse(xml) as any;

  if (doc.sitemapindex) {
    const sitemaps = toArray(doc.sitemapindex.sitemap).map((s: any) => String(s.loc));
    return { isIndex: true, entries: [], sitemaps };
  }

  const entries = toArray(doc.urlset?.url).map((u: any) => ({
    url: String(u.loc),
    lastmod: u.lastmod != null ? String(u.lastmod) : null,
  }));
  return { isIndex: false, entries, sitemaps: [] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sitemap.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sitemap.ts lib/sitemap.test.ts
git commit -m "feat: sitemap and sitemap-index parsing"
```

---

## Task 6: robots.txt wrapper

**Files:**
- Create: `lib/robots.ts`
- Test: `lib/robots.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/robots.test.ts
import { expect, test } from "vitest";
import { makeRobots } from "./robots";

const body = `User-agent: *
Disallow: /private
Crawl-delay: 2`;

test("blocks disallowed paths, allows others", () => {
  const r = makeRobots("https://x.com/robots.txt", body);
  expect(r.allowed("https://x.com/private/page")).toBe(false);
  expect(r.allowed("https://x.com/products/a")).toBe(true);
});

test("reports crawl-delay seconds", () => {
  const r = makeRobots("https://x.com/robots.txt", body);
  expect(r.crawlDelay()).toBe(2);
});

test("defaults to allow + zero delay when robots is empty", () => {
  const r = makeRobots("https://x.com/robots.txt", "");
  expect(r.allowed("https://x.com/anything")).toBe(true);
  expect(r.crawlDelay()).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/robots.test.ts`
Expected: FAIL ("Cannot find module './robots'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/robots.ts
import robotsParser from "robots-parser";

export const USER_AGENT = "UnionTechRAGBot";

export function makeRobots(robotsUrl: string, body: string) {
  const robots = robotsParser(robotsUrl, body);
  return {
    allowed(url: string, ua: string = USER_AGENT): boolean {
      return robots.isAllowed(url, ua) ?? true;
    },
    crawlDelay(ua: string = USER_AGENT): number {
      return robots.getCrawlDelay(ua) ?? 0;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/robots.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/robots.ts lib/robots.test.ts
git commit -m "feat: robots.txt wrapper"
```

---

## Task 7: HTML extraction — main content + spec tables + doc-type classifier

**Files:**
- Create: `lib/extract.ts`
- Test: `lib/extract.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/extract.test.ts
import { expect, test } from "vitest";
import { extractMainContent, extractSpecTables, classifyDocType } from "./extract";

const html = `<html><head><title>RSPro 2100</title></head>
<body>
  <nav>MENU</nav>
  <header>HEAD</header>
  <main>
    <h1>RSPro 2100</h1>
    <p>Large-format SLA printer.</p>
    <table>
      <caption>Specifications</caption>
      <tr><th>Build Volume</th><td>600 x 600 x 400 mm</td></tr>
      <tr><th>Laser</th><td>355 nm</td></tr>
    </table>
  </main>
  <footer>FOOT</footer>
  <script>var x=1;</script>
</body></html>`;

test("extractMainContent drops nav/header/footer/script", () => {
  const text = extractMainContent(html);
  expect(text).toContain("Large-format SLA printer.");
  expect(text).not.toContain("MENU");
  expect(text).not.toContain("FOOT");
  expect(text).not.toContain("var x");
});

test("extractSpecTables serializes rows as 'header: value'", () => {
  const tables = extractSpecTables(html);
  expect(tables).toHaveLength(1);
  expect(tables[0].caption).toBe("Specifications");
  expect(tables[0].rows).toEqual([
    "Build Volume: 600 x 600 x 400 mm",
    "Laser: 355 nm",
  ]);
});

test("classifyDocType maps URL paths to doc types", () => {
  expect(classifyDocType("https://x.com/products/rspro-2100.html")).toBe("product");
  expect(classifyDocType("https://x.com/case/dental.html")).toBe("case");
  expect(classifyDocType("https://x.com/company-news/launch.html")).toBe("news");
  expect(classifyDocType("https://x.com/blog/tips.html")).toBe("blog");
  expect(classifyDocType("https://x.com/stereolithography-resin")).toBe("material");
  expect(classifyDocType("https://x.com/about")).toBe("company");
  expect(classifyDocType("https://x.com/3d-printing-in-automotive-industry.html")).toBe("solution");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/extract.test.ts`
Expected: FAIL ("Cannot find module './extract'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/extract.ts
import * as cheerio from "cheerio";
import type { DocType, SpecTable } from "./types";

const STRIP = ["nav", "header", "footer", "script", "style", "noscript",
  ".cookie", ".cookie-banner", "#cookie"];

export function extractMainContent(html: string): string {
  const $ = cheerio.load(html);
  for (const sel of STRIP) $(sel).remove();
  const root = $("main").length ? $("main") : $("body");
  return root.text().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function extractSpecTables(html: string): SpecTable[] {
  const $ = cheerio.load(html);
  const tables: SpecTable[] = [];
  $("table").each((_, table) => {
    const caption = $(table).find("caption").first().text().trim() || "Specifications";
    const rows: string[] = [];
    $(table).find("tr").each((_, tr) => {
      const cells = $(tr).find("th,td");
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim();
        const val = $(cells.slice(1).toArray()).map((_, c) => $(c).text().trim()).get().join(" ");
        if (key && val) rows.push(`${key}: ${val}`);
      }
    });
    if (rows.length) tables.push({ caption, rows });
  });
  return tables;
}

export function classifyDocType(url: string): DocType {
  const p = new URL(url).pathname.toLowerCase();
  if (p.includes("/products/")) return "product";
  if (p.includes("/case")) return "case";
  if (p.includes("news")) return "news";
  if (p.includes("/blog")) return "blog";
  if (p.includes("material") || p.includes("resin")) return "material";
  if (p.includes("software") || p.includes("/ut-one") || p.includes("polydevs")) return "software";
  if (p === "/about" || p.includes("/company") || p.includes("/contact")) return "company";
  return "solution";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/extract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/extract.ts lib/extract.test.ts
git commit -m "feat: HTML main-content + spec-table extraction + doc-type classifier"
```

---

## Task 8: Chunking with token estimate, overlap, and stable IDs

**Files:**
- Create: `lib/chunk.ts`
- Test: `lib/chunk.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/chunk.test.ts
import { expect, test } from "vitest";
import { estimateTokens, splitIntoChunks, hashId, buildChunks } from "./chunk";
import type { RawDoc } from "./types";

test("estimateTokens approximates by chars/4", () => {
  expect(estimateTokens("abcd")).toBe(1);
  expect(estimateTokens("a".repeat(40))).toBe(10);
});

test("splitIntoChunks keeps chunks under the token budget with overlap", () => {
  const para = "x".repeat(400); // ~100 tokens each
  const text = Array(10).fill(para).join("\n\n");
  const chunks = splitIntoChunks(text, 300, 100);
  expect(chunks.length).toBeGreaterThan(1);
  for (const c of chunks) expect(estimateTokens(c)).toBeLessThanOrEqual(400);
});

test("hashId is deterministic and url-safe", () => {
  expect(hashId("abc")).toBe(hashId("abc"));
  expect(hashId("abc")).toMatch(/^[a-z0-9]+$/);
});

test("buildChunks emits one chunk per spec table plus text chunks with metadata", () => {
  const doc: RawDoc = {
    url: "https://x.com/products/a",
    title: "A",
    docType: "product",
    lastmod: "2025-01-01",
    sourceType: "html-text",
    mainText: "Para one.\n\nPara two.",
    specTables: [{ caption: "Specs", rows: ["Build Volume: 600mm", "Laser: 355nm"] }],
  };
  const chunks = buildChunks(doc);
  const tableChunks = chunks.filter((c) => c.sourceType === "html-table");
  expect(tableChunks).toHaveLength(1);
  expect(tableChunks[0].text).toContain("Build Volume: 600mm");
  expect(chunks.every((c) => c.url === "https://x.com/products/a")).toBe(true);
  expect(chunks.every((c) => c.docType === "product")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/chunk.test.ts`
Expected: FAIL ("Cannot find module './chunk'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/chunk.ts
import type { Chunk, RawDoc } from "./types";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function splitIntoChunks(text: string, maxTokens = 800, overlapTokens = 100): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur: string[] = [];
  let curTokens = 0;

  for (const p of paras) {
    const t = estimateTokens(p);
    if (curTokens + t > maxTokens && cur.length) {
      chunks.push(cur.join("\n\n"));
      const overlap: string[] = [];
      let ot = 0;
      for (let i = cur.length - 1; i >= 0 && ot < overlapTokens; i--) {
        overlap.unshift(cur[i]);
        ot += estimateTokens(cur[i]);
      }
      cur = [...overlap];
      curTokens = ot;
    }
    cur.push(p);
    curTokens += t;
  }
  if (cur.length) chunks.push(cur.join("\n\n"));
  return chunks;
}

// chunkId is a placeholder here ("") — global sequential IDs (c0, c1, ...) are
// assigned during index assembly in scripts/ingest.ts so citation labels are stable.
export function buildChunks(doc: RawDoc): Chunk[] {
  const out: Chunk[] = [];

  for (const table of doc.specTables) {
    out.push({
      chunkId: "",
      url: doc.url,
      title: doc.title,
      docType: doc.docType,
      sourceType: "html-table",
      headingPath: [table.caption],
      lastmod: doc.lastmod,
      text: `${table.caption}\n${table.rows.join("\n")}`,
    });
  }

  for (const piece of splitIntoChunks(doc.mainText)) {
    out.push({
      chunkId: "",
      url: doc.url,
      title: doc.title,
      docType: doc.docType,
      sourceType: doc.sourceType,
      headingPath: [],
      lastmod: doc.lastmod,
      text: piece,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/chunk.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/chunk.ts lib/chunk.test.ts
git commit -m "feat: heading/table-aware chunking"
```

---

## Task 9: Index store — save/load with normalization + module cache

**Files:**
- Create: `lib/index-store.ts`
- Test: `lib/index-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/index-store.test.ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveIndex, loadIndex, _clearCache } from "./index-store";
import type { Chunk } from "./types";

const dirs: string[] = [];
function tempDir() {
  const d = mkdtempSync(join(tmpdir(), "idx-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  _clearCache();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "t0", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "a" },
  { chunkId: "c1", url: "u1", title: "t1", docType: "blog", sourceType: "html-text", headingPath: [], lastmod: null, text: "b" },
];

test("save then load round-trips records and normalizes vectors to unit length", async () => {
  const dir = tempDir();
  await saveIndex(dir, records, [[3, 4], [0, 5]]); // norms 5 and 5
  const idx = loadIndex(dir);
  expect(idx.dim).toBe(2);
  expect(idx.records).toHaveLength(2);
  // first vector normalized: [0.6, 0.8]
  expect(idx.matrix[0]).toBeCloseTo(0.6, 5);
  expect(idx.matrix[1]).toBeCloseTo(0.8, 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/index-store.test.ts`
Expected: FAIL ("Cannot find module './index-store'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/index-store.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/index-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/index-store.ts lib/index-store.test.ts
git commit -m "feat: vector index store (save/load, unit-normalized, cached)"
```

---

## Task 10: Vector search (cosine via dot product on normalized rows)

**Files:**
- Create: `lib/vector.ts`
- Test: `lib/vector.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/vector.test.ts
import { expect, test } from "vitest";
import { cosineSearch } from "./vector";

// 3 rows, dim 2, already unit-normalized
const matrix = new Float32Array([
  1, 0,        // row 0 -> points +x
  0, 1,        // row 1 -> points +y
  0.7071, 0.7071, // row 2 -> 45deg
]);

test("returns indices ranked by cosine to the query", () => {
  const res = cosineSearch(matrix, 2, [1, 0], 3);
  expect(res[0].idx).toBe(0);
  expect(res[0].score).toBeCloseTo(1, 3);
  expect(res[1].idx).toBe(2); // 45deg closer than +y
  expect(res[2].idx).toBe(1);
});

test("respects topN", () => {
  const res = cosineSearch(matrix, 2, [1, 0], 1);
  expect(res).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/vector.test.ts`
Expected: FAIL ("Cannot find module './vector'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/vector.ts
export interface SearchHit {
  idx: number;
  score: number; // cosine in [-1, 1]
}

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function cosineSearch(
  matrix: Float32Array,
  dim: number,
  query: number[],
  topN: number,
): SearchHit[] {
  const q = normalize(query);
  const rows = matrix.length / dim;
  const hits: SearchHit[] = [];
  for (let r = 0; r < rows; r++) {
    let dot = 0;
    const base = r * dim;
    for (let d = 0; d < dim; d++) dot += matrix[base + d] * q[d];
    hits.push({ idx: r, score: dot });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topN);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/vector.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/vector.ts lib/vector.test.ts
git commit -m "feat: cosine vector search"
```

---

## Task 11: Keyword scoring + exact model-number match

**Files:**
- Create: `lib/keyword.ts`
- Test: `lib/keyword.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/keyword.test.ts
import { expect, test } from "vitest";
import { tokenize, keywordScores, hasExactModelMatch } from "./keyword";
import type { Chunk } from "./types";

const mk = (text: string): Chunk => ({
  chunkId: "c", url: "u", title: "t", docType: "product",
  sourceType: "html-text", headingPath: [], lastmod: null, text,
});

test("tokenize lowercases and keeps alphanumerics", () => {
  expect(tokenize("RSPro 2100, build-volume!")).toEqual(["rspro", "2100", "build", "volume"]);
});

test("keywordScores ranks higher for more overlap", () => {
  const records = [mk("build volume of the rspro 2100"), mk("dental resin colors")];
  const scores = keywordScores(records, "rspro 2100 build volume");
  expect(scores[0]).toBeGreaterThan(scores[1]);
});

test("hasExactModelMatch detects digit-bearing tokens present in chunk", () => {
  expect(hasExactModelMatch(mk("the rspro 2100 has..."), "specs of rspro 2100")).toBe(true);
  expect(hasExactModelMatch(mk("dental resin"), "specs of rspro 2100")).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/keyword.test.ts`
Expected: FAIL ("Cannot find module './keyword'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/keyword.ts
import type { Chunk } from "./types";

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(Boolean);
}

export function keywordScores(records: Chunk[], query: string): number[] {
  const qTokens = tokenize(query);
  const qSet = new Set(qTokens);
  if (qSet.size === 0) return records.map(() => 0);
  return records.map((r) => {
    const docTokens = new Set(tokenize(r.text));
    let overlap = 0;
    for (const t of qSet) if (docTokens.has(t)) overlap++;
    return overlap / qSet.size;
  });
}

// A "model token" has a digit (e.g. "2100", "600"). Exact match = present verbatim.
export function hasExactModelMatch(record: Chunk, query: string): boolean {
  const modelTokens = tokenize(query).filter((t) => /\d/.test(t));
  if (modelTokens.length === 0) return false;
  const docTokens = new Set(tokenize(record.text));
  return modelTokens.some((t) => docTokens.has(t));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/keyword.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/keyword.ts lib/keyword.test.ts
git commit -m "feat: keyword scoring + exact model-number match"
```

---

## Task 12: Fusion (RRF) + authority weighting + answerability guard

**Files:**
- Create: `lib/fuse.ts`
- Test: `lib/fuse.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/fuse.test.ts
import { expect, test } from "vitest";
import { rrf, authorityWeight, fuseAndRank, shouldAnswer } from "./fuse";
import type { Chunk, RetrievedChunk } from "./types";

const mk = (id: string, docType: Chunk["docType"], text: string, lastmod: string | null = null): Chunk => ({
  chunkId: id, url: `u/${id}`, title: id, docType,
  sourceType: "html-text", headingPath: [], lastmod, text,
});

test("rrf rewards items ranked high across lists", () => {
  const m = rrf([[2, 0, 1], [0, 2, 1]], 60); // idx 0 and 2 both appear near top
  expect(m.get(0)).toBeGreaterThan(m.get(1)!);
});

test("authorityWeight favors product over blog and recent over old", () => {
  const now = "2026-06-09T00:00:00Z";
  expect(authorityWeight("product", null, now)).toBeGreaterThan(authorityWeight("blog", null, now));
  expect(authorityWeight("product", "2026-01-01", now))
    .toBeGreaterThan(authorityWeight("product", "2019-01-01", now));
});

test("fuseAndRank surfaces the product spec chunk above an old blog mention", () => {
  const records = [
    mk("0", "blog", "rspro 2100 was launched", "2019-01-01"),
    mk("1", "product", "Build Volume: 600x600x400 mm rspro 2100", "2026-01-01"),
  ];
  const semantic = [{ idx: 0, score: 0.7 }, { idx: 1, score: 0.69 }];
  const keyword = [0.5, 0.9];
  const ranked = fuseAndRank({ records, semantic, keyword, nowIso: "2026-06-09T00:00:00Z", topK: 2 });
  expect(ranked[0].chunkId).toBe("1");
  expect(ranked[0].cosine).toBeCloseTo(0.69, 5);
});

test("shouldAnswer declines on weak cosine and no exact match", () => {
  const weak: RetrievedChunk[] = [{ ...mk("0", "blog", "unrelated"), cosine: 0.1, keyword: 0, score: 0.1 }];
  expect(shouldAnswer(weak, "totally unrelated question")).toBe(false);
});

test("shouldAnswer answers when an exact model match exists even at mid cosine", () => {
  const hit: RetrievedChunk[] = [{ ...mk("1", "product", "rspro 2100 build volume 600mm"), cosine: 0.3, keyword: 0.8, score: 0.9 }];
  expect(shouldAnswer(hit, "rspro 2100 build volume")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/fuse.test.ts`
Expected: FAIL ("Cannot find module './fuse'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/fuse.ts
import type { Chunk, DocType, RetrievedChunk } from "./types";
import { hasExactModelMatch } from "./keyword";
import type { SearchHit as Hit } from "./vector";

const DOC_AUTHORITY: Record<DocType, number> = {
  product: 1.0, material: 1.0, software: 0.95, solution: 0.9,
  case: 0.9, company: 0.85, blog: 0.7, news: 0.65,
};

export const COSINE_FLOOR = 0.28;

export function rrf(rankings: number[][], k = 60): Map<number, number> {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((idx, rank) => {
      scores.set(idx, (scores.get(idx) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}

export function authorityWeight(docType: DocType, lastmod: string | null, nowIso: string): number {
  let w = DOC_AUTHORITY[docType] ?? 0.7;
  if (lastmod) {
    const ageMs = Date.parse(nowIso) - Date.parse(lastmod);
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);
    if (ageMonths <= 18) w += 0.1;
    else if (ageMonths >= 60) w -= 0.1;
  }
  return w;
}

export interface FuseArgs {
  records: Chunk[];
  semantic: Hit[];
  keyword: number[];
  nowIso: string;
  topK: number;
}

export function fuseAndRank(args: FuseArgs): RetrievedChunk[] {
  const { records, semantic, keyword, nowIso, topK } = args;

  const semByIdx = new Map(semantic.map((h) => [h.idx, h.score]));
  const semRanking = [...semantic].sort((a, b) => b.score - a.score).map((h) => h.idx);
  const kwRanking = keyword
    .map((s, idx) => ({ idx, s }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.idx);

  const fused = rrf([semRanking, kwRanking]);

  const scored: RetrievedChunk[] = records.map((r, idx) => {
    const base = fused.get(idx) ?? 0;
    const auth = authorityWeight(r.docType, r.lastmod, nowIso);
    return {
      ...r,
      cosine: semByIdx.get(idx) ?? 0,
      keyword: keyword[idx] ?? 0,
      score: base * auth,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function shouldAnswer(top: RetrievedChunk[], query: string): boolean {
  if (top.length === 0) return false;
  const best = top[0];
  if (best.cosine >= COSINE_FLOOR) return true;
  return top.some((c) => hasExactModelMatch(c, query));
}
```

> Note: `authorityWeight` calls `Date.parse` (pure, deterministic) — not `Date.now()`. The "now" value is always passed in.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/fuse.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/fuse.ts lib/fuse.test.ts
git commit -m "feat: RRF fusion, authority weighting, answerability guard"
```

---

## Task 13: Query rewrite (history-aware, standalone)

**Files:**
- Create: `lib/rewrite.ts`
- Test: `lib/rewrite.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/rewrite.test.ts
import { expect, test } from "vitest";
import { rewriteQuery } from "./rewrite";
import type { ChatMessage } from "./types";

test("returns the question unchanged when there is no history", async () => {
  const out = await rewriteQuery([], "What is the build volume?", async () => "SHOULD NOT CALL");
  expect(out).toBe("What is the build volume?");
});

test("uses the completion to produce a standalone query when history exists", async () => {
  const history: ChatMessage[] = [
    { role: "user", content: "Tell me about the RSPro 2100." },
    { role: "assistant", content: "It is a large SLA printer." },
  ];
  let seen = "";
  const fakeComplete = async (msgs: ChatMessage[]) => {
    seen = msgs[msgs.length - 1].content;
    return "RSPro 2100 build volume";
  };
  const out = await rewriteQuery(history, "and its build volume?", fakeComplete);
  expect(out).toBe("RSPro 2100 build volume");
  expect(seen).toContain("and its build volume?");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/rewrite.test.ts`
Expected: FAIL ("Cannot find module './rewrite'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/rewrite.ts
import type { ChatMessage } from "./types";

export type CompleteFn = (messages: ChatMessage[]) => Promise<string>;

export async function rewriteQuery(
  history: ChatMessage[],
  question: string,
  complete: CompleteFn,
): Promise<string> {
  if (history.length === 0) return question;

  const convo = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Rewrite the user's latest message into a single standalone search query " +
        "using the conversation for context. Output ONLY the query, no preamble.",
    },
    { role: "user", content: `Conversation:\n${convo}\n\nLatest message: ${question}\n\nStandalone query:` },
  ];

  const out = (await complete(messages)).trim();
  return out || question;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/rewrite.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rewrite.ts lib/rewrite.test.ts
git commit -m "feat: history-aware query rewrite"
```

---

## Task 14: Retrieval orchestrator

**Files:**
- Create: `lib/retrieve.ts`
- Test: `lib/retrieve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/retrieve.test.ts
import { expect, test } from "vitest";
import { retrieve } from "./retrieve";
import type { Chunk, LoadedIndex, ChatMessage } from "./types";

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "RSPro 2100", docType: "product", sourceType: "html-table", headingPath: [], lastmod: "2026-01-01", text: "Build Volume: 600x600x400 mm rspro 2100" },
  { chunkId: "c1", url: "u1", title: "Blog", docType: "blog", sourceType: "html-text", headingPath: [], lastmod: "2019-01-01", text: "dental resin colors" },
];
// dim 2, normalized rows: c0 -> +x, c1 -> +y
const index: LoadedIndex = { dim: 2, records, matrix: new Float32Array([1, 0, 0, 1]) };

test("retrieve returns ranked chunks and marks answerable for an on-topic query", async () => {
  const deps = {
    index,
    embedQuery: async (_q: string) => [1, 0], // aligns with c0
    complete: async (_m: ChatMessage[]) => "unused",
    nowIso: "2026-06-09T00:00:00Z",
  };
  const res = await retrieve("rspro 2100 build volume", [], deps);
  expect(res.chunks[0].chunkId).toBe("c0");
  expect(res.answerable).toBe(true);
  expect(res.query).toBe("rspro 2100 build volume");
});

test("retrieve declines for an off-topic query", async () => {
  const deps = {
    index,
    embedQuery: async (_q: string) => [-1, -1], // points away from everything
    complete: async (_m: ChatMessage[]) => "unused",
    nowIso: "2026-06-09T00:00:00Z",
  };
  const res = await retrieve("how do I bake bread", [], deps);
  expect(res.answerable).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/retrieve.test.ts`
Expected: FAIL ("Cannot find module './retrieve'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/retrieve.ts
import type { ChatMessage, LoadedIndex, RetrievedChunk } from "./types";
import { cosineSearch } from "./vector";
import { keywordScores } from "./keyword";
import { fuseAndRank, shouldAnswer } from "./fuse";
import { rewriteQuery } from "./rewrite";

export interface RetrieveDeps {
  index: LoadedIndex;
  embedQuery: (q: string) => Promise<number[]>;
  complete: (messages: ChatMessage[]) => Promise<string>;
  nowIso: string;
  topN?: number;
  topK?: number;
}

export interface RetrieveResult {
  query: string;
  chunks: RetrievedChunk[];
  answerable: boolean;
}

export async function retrieve(
  question: string,
  history: ChatMessage[],
  deps: RetrieveDeps,
): Promise<RetrieveResult> {
  const topN = deps.topN ?? 40;
  const topK = deps.topK ?? 8;

  const query = await rewriteQuery(history, question, deps.complete);
  const qVec = await deps.embedQuery(query);

  const semantic = cosineSearch(deps.index.matrix, deps.index.dim, qVec, topN);
  const keyword = keywordScores(deps.index.records, query);

  const chunks = fuseAndRank({
    records: deps.index.records,
    semantic,
    keyword,
    nowIso: deps.nowIso,
    topK,
  });

  return { query, chunks, answerable: shouldAnswer(chunks, query) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/retrieve.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/retrieve.ts lib/retrieve.test.ts
git commit -m "feat: hybrid retrieval orchestrator"
```

---

## Task 15: Prompt assembly with citation IDs

**Files:**
- Create: `lib/prompt.ts`
- Test: `lib/prompt.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/prompt.test.ts
import { expect, test } from "vitest";
import { buildSystemPrompt, buildContext, buildMessages } from "./prompt";
import type { RetrievedChunk, ChatMessage } from "./types";

const chunks: RetrievedChunk[] = [
  { chunkId: "c0", url: "https://x.com/a", title: "A", docType: "product", sourceType: "html-table", headingPath: [], lastmod: null, text: "Build Volume: 600mm", cosine: 0.9, keyword: 0.5, score: 1 },
  { chunkId: "c1", url: "https://x.com/b", title: "B", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "Laser: 355nm", cosine: 0.8, keyword: 0.4, score: 0.9 },
];

test("system prompt forbids fabrication and requires citations", () => {
  const p = buildSystemPrompt();
  expect(p.toLowerCase()).toContain("only");
  expect(p).toContain("[n]");
});

test("buildContext numbers sources 1..k and returns aligned source refs", () => {
  const { context, sources } = buildContext(chunks);
  expect(context).toContain("[1]");
  expect(context).toContain("https://x.com/a");
  expect(sources).toEqual([
    { n: 1, url: "https://x.com/a", title: "A" },
    { n: 2, url: "https://x.com/b", title: "B" },
  ]);
});

test("buildMessages places system + context + history + question", () => {
  const history: ChatMessage[] = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }];
  const { messages } = buildMessages(history, "build volume?", chunks);
  expect(messages[0].role).toBe("system");
  expect(messages.some((m) => m.content.includes("build volume?"))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prompt.test.ts`
Expected: FAIL ("Cannot find module './prompt'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/prompt.ts
import type { ChatMessage, RetrievedChunk, SourceRef } from "./types";

export function buildSystemPrompt(): string {
  return [
    "You are UnionTech's product assistant. Answer ONLY using the provided context.",
    "If the context does not contain the answer, say you don't have that information.",
    "Never invent specifications, model names, or numbers.",
    "Cite every factual claim with the matching source label in square brackets, e.g. [1] or [2].",
    "Use the form [n] where n is a source number from the context.",
  ].join(" ");
}

export function buildContext(chunks: RetrievedChunk[]): { context: string; sources: SourceRef[] } {
  const sources: SourceRef[] = chunks.map((c, i) => ({ n: i + 1, url: c.url, title: c.title }));
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.title} — ${c.url})\n${c.text}`)
    .join("\n\n");
  return { context, sources };
}

export function buildMessages(
  history: ChatMessage[],
  question: string,
  chunks: RetrievedChunk[],
): { messages: ChatMessage[]; sources: SourceRef[] } {
  const { context, sources } = buildContext(chunks);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "system", content: `Context:\n${context}` },
    ...history,
    { role: "user", content: question },
  ];
  return { messages, sources };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prompt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/prompt.ts lib/prompt.test.ts
git commit -m "feat: prompt assembly with citation IDs"
```

---

## Task 16: Citation parsing + validation

**Files:**
- Create: `lib/citations.ts`
- Test: `lib/citations.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/citations.test.ts
import { expect, test } from "vitest";
import { parseCitations, validateCitations } from "./citations";
import type { SourceRef } from "./types";

const sources: SourceRef[] = [
  { n: 1, url: "https://x.com/a", title: "A" },
  { n: 2, url: "https://x.com/b", title: "B" },
];

test("parseCitations extracts unique numeric labels", () => {
  expect(parseCitations("Foo [1] bar [2] baz [1].")).toEqual([1, 2]);
});

test("validateCitations keeps in-range labels and drops out-of-range", () => {
  const { citations, cleanedAnswer } = validateCitations("Spec is X [1]. Also [5].", sources);
  expect(citations).toEqual([{ n: 1, url: "https://x.com/a", title: "A" }]);
  expect(cleanedAnswer).toBe("Spec is X [1]. Also .");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/citations.test.ts`
Expected: FAIL ("Cannot find module './citations'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/citations.ts
import type { SourceRef } from "./types";

export function parseCitations(answer: string): number[] {
  const found = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return [...new Set(found)];
}

export function validateCitations(
  answer: string,
  sources: SourceRef[],
): { citations: SourceRef[]; cleanedAnswer: string } {
  const valid = new Set(sources.map((s) => s.n));
  const used = parseCitations(answer).filter((n) => valid.has(n));
  const cleanedAnswer = answer.replace(/\[(\d+)\]/g, (full, d) =>
    valid.has(Number(d)) ? full : "",
  );
  const citations = sources.filter((s) => used.includes(s.n));
  return { citations, cleanedAnswer };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/citations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/citations.ts lib/citations.test.ts
git commit -m "feat: citation parsing and validation"
```

---

## Task 17: Rate limiting + request-size guard

**Files:**
- Create: `lib/ratelimit.ts`
- Test: `lib/ratelimit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/ratelimit.test.ts
import { expect, test } from "vitest";
import { TokenBucket, checkRequestSize } from "./ratelimit";
import type { ChatMessage } from "./types";

test("TokenBucket allows up to capacity then blocks until refill", () => {
  const bucket = new TokenBucket(2, 1, 1000); // capacity 2, 1 token/sec, start t=1000ms
  expect(bucket.tryRemove("ip", 1000)).toBe(true);
  expect(bucket.tryRemove("ip", 1000)).toBe(true);
  expect(bucket.tryRemove("ip", 1000)).toBe(false); // empty
  expect(bucket.tryRemove("ip", 2000)).toBe(true);  // +1s refills 1
});

test("separate keys have separate buckets", () => {
  const bucket = new TokenBucket(1, 1, 0);
  expect(bucket.tryRemove("a", 0)).toBe(true);
  expect(bucket.tryRemove("b", 0)).toBe(true);
});

test("checkRequestSize rejects overly long messages or history", () => {
  const longMsg = "x".repeat(9000);
  expect(checkRequestSize(longMsg, []).ok).toBe(false);
  const many: ChatMessage[] = Array(50).fill({ role: "user", content: "hi" });
  expect(checkRequestSize("ok", many).ok).toBe(false);
  expect(checkRequestSize("ok", []).ok).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ratelimit.test.ts`
Expected: FAIL ("Cannot find module './ratelimit'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/ratelimit.ts
import type { ChatMessage } from "./types";

interface BucketState {
  tokens: number;
  last: number; // ms
}

export class TokenBucket {
  private state = new Map<string, BucketState>();
  constructor(
    private capacity: number,
    private refillPerSec: number,
    startMs: number,
  ) {
    this.startMs = startMs;
  }
  private startMs: number;

  tryRemove(key: string, nowMs: number): boolean {
    const s = this.state.get(key) ?? { tokens: this.capacity, last: this.startMs };
    const elapsedSec = Math.max(0, (nowMs - s.last) / 1000);
    s.tokens = Math.min(this.capacity, s.tokens + elapsedSec * this.refillPerSec);
    s.last = nowMs;
    let ok = false;
    if (s.tokens >= 1) {
      s.tokens -= 1;
      ok = true;
    }
    this.state.set(key, s);
    return ok;
  }
}

export const MAX_MESSAGE_CHARS = 8000;
export const MAX_HISTORY_TURNS = 30;

export function checkRequestSize(
  message: string,
  history: ChatMessage[],
): { ok: boolean; reason?: string } {
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, reason: "message too long" };
  }
  if (history.length > MAX_HISTORY_TURNS) {
    return { ok: false, reason: "conversation too long" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ratelimit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ratelimit.ts lib/ratelimit.test.ts
git commit -m "feat: token-bucket rate limiting + request-size guard"
```

---

## Task 18: Chat preparation (testable core of the route)

**Files:**
- Create: `lib/chat-core.ts`
- Test: `lib/chat-core.test.ts`

This isolates everything testable about the route (validation → retrieve → message build) from the streaming wrapper.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/chat-core.test.ts
import { expect, test } from "vitest";
import { prepareChat } from "./chat-core";
import type { Chunk, LoadedIndex, ChatMessage } from "./types";

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "RSPro 2100", docType: "product", sourceType: "html-table", headingPath: [], lastmod: "2026-01-01", text: "Build Volume: 600x600x400 mm rspro 2100" },
];
const index: LoadedIndex = { dim: 2, records, matrix: new Float32Array([1, 0]) };

const baseDeps = {
  index,
  embedQuery: async (_q: string) => [1, 0],
  complete: async (_m: ChatMessage[]) => "unused",
  nowIso: "2026-06-09T00:00:00Z",
};

test("rejects oversized message", async () => {
  const res = await prepareChat({ message: "x".repeat(9000), history: [] }, baseDeps);
  expect(res.ok).toBe(false);
});

test("returns decline payload when not answerable", async () => {
  const res = await prepareChat(
    { message: "bake bread", history: [] },
    { ...baseDeps, embedQuery: async () => [-1, -1] },
  );
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.answerable).toBe(false);
});

test("returns messages + sources when answerable", async () => {
  const res = await prepareChat({ message: "rspro 2100 build volume", history: [] }, baseDeps);
  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.answerable).toBe(true);
    expect(res.sources[0].url).toBe("u0");
    expect(res.messages[0].role).toBe("system");
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/chat-core.test.ts`
Expected: FAIL ("Cannot find module './chat-core'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/chat-core.ts
import type { ChatMessage, SourceRef } from "./types";
import { checkRequestSize } from "./ratelimit";
import { retrieve, type RetrieveDeps } from "./retrieve";
import { buildMessages } from "./prompt";

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export type PrepareResult =
  | { ok: false; reason: string }
  | { ok: true; answerable: false; sources: SourceRef[] }
  | { ok: true; answerable: true; messages: ChatMessage[]; sources: SourceRef[] };

export async function prepareChat(req: ChatRequest, deps: RetrieveDeps): Promise<PrepareResult> {
  const size = checkRequestSize(req.message, req.history);
  if (!size.ok) return { ok: false, reason: size.reason ?? "invalid request" };

  const { chunks, answerable } = await retrieve(req.message, req.history, deps);
  if (!answerable) return { ok: true, answerable: false, sources: [] };

  const { messages, sources } = buildMessages(req.history, req.message, chunks);
  return { ok: true, answerable: true, messages, sources };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/chat-core.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-core.ts lib/chat-core.test.ts
git commit -m "feat: testable chat preparation core"
```

---

## Task 19: PDF text extraction (thin, mockable wrapper)

**Files:**
- Create: `lib/pdf.ts`
- Test: `lib/pdf.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/pdf.test.ts
import { expect, test } from "vitest";
import { pdfToText } from "./pdf";

test("joins extracted page texts with blank lines", async () => {
  const fakeExtract = async (_data: Uint8Array) => ({ text: ["Page one", "Page two"] });
  const out = await pdfToText(new Uint8Array([1, 2, 3]), fakeExtract as any);
  expect(out).toBe("Page one\n\nPage two");
});

test("handles a single string text result", async () => {
  const fakeExtract = async (_data: Uint8Array) => ({ text: "Only page" });
  const out = await pdfToText(new Uint8Array([1]), fakeExtract as any);
  expect(out).toBe("Only page");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pdf.test.ts`
Expected: FAIL ("Cannot find module './pdf'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/pdf.ts
import { extractText, getDocumentProxy } from "unpdf";

export type ExtractFn = (data: Uint8Array) => Promise<{ text: string | string[] }>;

// Default extractor uses unpdf; injectable for tests.
const defaultExtract: ExtractFn = async (data) => {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return { text };
};

export async function pdfToText(
  data: Uint8Array,
  extract: ExtractFn = defaultExtract,
): Promise<string> {
  const { text } = await extract(data);
  return Array.isArray(text) ? text.join("\n\n") : text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/pdf.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf.ts lib/pdf.test.ts
git commit -m "feat: PDF text extraction wrapper"
```

---

## Task 20: Crawl fetcher (retry/backoff, cache, PDF/HTML routing)

**Files:**
- Create: `lib/crawl.ts`
- Test: `lib/crawl.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/crawl.test.ts
import { expect, test } from "vitest";
import { fetchWithRetry, isPdfUrl } from "./crawl";

test("isPdfUrl detects .pdf", () => {
  expect(isPdfUrl("https://x.com/a.pdf")).toBe(true);
  expect(isPdfUrl("https://x.com/a.html")).toBe(false);
});

test("fetchWithRetry retries on failure then succeeds", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls < 2) throw new Error("network");
    return new Response("ok", { status: 200 });
  };
  const res = await fetchWithRetry("https://x.com", { retries: 3, baseDelayMs: 0 }, fakeFetch as any);
  expect(await res.text()).toBe("ok");
  expect(calls).toBe(2);
});

test("fetchWithRetry throws after exhausting retries", async () => {
  const fakeFetch = async () => new Response("err", { status: 500 });
  await expect(
    fetchWithRetry("https://x.com", { retries: 2, baseDelayMs: 0 }, fakeFetch as any),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/crawl.test.ts`
Expected: FAIL ("Cannot find module './crawl'").

- [ ] **Step 3: Write the implementation**

```ts
// lib/crawl.ts
export function isPdfUrl(url: string): boolean {
  return new URL(url).pathname.toLowerCase().endsWith(".pdf");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOpts {
  retries: number;
  baseDelayMs: number;
}

export async function fetchWithRetry(
  url: string,
  opts: RetryOpts,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": "UnionTechRAGBot" } });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < opts.retries) await sleep(opts.baseDelayMs * Math.pow(2, attempt));
  }
  throw new Error(`fetchWithRetry failed for ${url}: ${String(lastErr)}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/crawl.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/crawl.ts lib/crawl.test.ts
git commit -m "feat: crawl fetcher with retry/backoff"
```

---

## Task 21: Ingestion script (orchestration)

**Files:**
- Create: `scripts/ingest.ts`
- Create: `lib/pipeline.ts` (testable assembly: docs → chunks → embeds → index inputs)
- Test: `lib/pipeline.test.ts`

The script itself is thin I/O glue; the assembly logic that assigns global chunk IDs is unit-tested in `lib/pipeline.ts`.

- [ ] **Step 1: Write the failing test for the assembly helper**

```ts
// lib/pipeline.test.ts
import { expect, test } from "vitest";
import { assignChunkIds, htmlToRawDoc } from "./pipeline";
import type { Chunk } from "./types";

test("assignChunkIds assigns sequential c0..cN", () => {
  const chunks: Chunk[] = [
    { chunkId: "", url: "u", title: "t", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "a" },
    { chunkId: "", url: "u", title: "t", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "b" },
  ];
  const out = assignChunkIds(chunks);
  expect(out.map((c) => c.chunkId)).toEqual(["c0", "c1"]);
});

test("htmlToRawDoc produces a RawDoc with title, content, spec tables, doc type", () => {
  const html = `<html><head><title>RSPro 2100</title></head><body><main>
    <p>SLA printer.</p>
    <table><caption>Specs</caption><tr><th>Build Volume</th><td>600mm</td></tr></table>
  </main></body></html>`;
  const doc = htmlToRawDoc("https://x.com/products/rspro-2100.html", html, "2026-01-01");
  expect(doc.title).toBe("RSPro 2100");
  expect(doc.docType).toBe("product");
  expect(doc.mainText).toContain("SLA printer.");
  expect(doc.specTables[0].rows).toEqual(["Build Volume: 600mm"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pipeline.test.ts`
Expected: FAIL ("Cannot find module './pipeline'").

- [ ] **Step 3: Write the assembly helper**

```ts
// lib/pipeline.ts
import * as cheerio from "cheerio";
import type { Chunk, RawDoc } from "./types";
import { extractMainContent, extractSpecTables, classifyDocType } from "./extract";

export function assignChunkIds(chunks: Chunk[]): Chunk[] {
  return chunks.map((c, i) => ({ ...c, chunkId: `c${i}` }));
}

export function htmlToRawDoc(url: string, html: string, lastmod: string | null): RawDoc {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;
  return {
    url,
    title,
    docType: classifyDocType(url),
    lastmod,
    sourceType: "html-text",
    mainText: extractMainContent(html),
    specTables: extractSpecTables(html),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pipeline.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the ingestion script (glue — no unit test; verified by a manual dry run)**

```ts
// scripts/ingest.ts
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
```

- [ ] **Step 6: Commit (script + helper)**

```bash
git add scripts/ingest.ts lib/pipeline.ts lib/pipeline.test.ts
git commit -m "feat: ingestion pipeline and orchestration script"
```

---

## Task 22: Chat API route (streaming wrapper)

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `lib/runtime.ts` (lazy singletons: config, index, embed/complete bound to config)

- [ ] **Step 1: Write `lib/runtime.ts`**

```ts
// lib/runtime.ts
import { loadConfig, type Config } from "./config";
import { loadIndex, DEFAULT_INDEX_DIR } from "./index-store";
import { embed, complete } from "./minimax";
import type { ChatMessage, LoadedIndex } from "./types";

let cfg: Config | null = null;
let index: LoadedIndex | null = null;

export function getConfig(): Config {
  if (!cfg) cfg = loadConfig();
  return cfg;
}

export function getIndex(): LoadedIndex {
  if (!index) index = loadIndex(DEFAULT_INDEX_DIR);
  return index;
}

export function getRetrieveDeps() {
  const c = getConfig();
  return {
    index: getIndex(),
    embedQuery: async (q: string) => (await embed([q], "query", c))[0],
    complete: (messages: ChatMessage[]) => complete(messages, c),
    nowIso: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Write the route**

```ts
// app/api/chat/route.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getConfig, getRetrieveDeps } from "@/lib/runtime";
import { prepareChat } from "@/lib/chat-core";
import { TokenBucket } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const bucket = new TokenBucket(20, 0.5, Date.now()); // 20 burst, 1 per 2s refill

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!bucket.tryRemove(ip, Date.now())) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  const body = (await req.json()) as { message: string; history?: ChatMessage[] };
  const history = body.history ?? [];

  let prepared;
  try {
    prepared = await prepareChat({ message: body.message, history }, getRetrieveDeps());
  } catch (e) {
    console.error("prepareChat error:", String(e));
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }

  if (!prepared.ok) return new Response(prepared.reason, { status: 400 });

  if (!prepared.answerable) {
    return Response.json({
      answer: "I don't have that information in UnionTech's documentation.",
      sources: [],
    });
  }

  const cfg = getConfig();
  const provider = createOpenAICompatible({
    name: "minimax",
    baseURL: cfg.MINIMAX_CHAT_BASE_URL,
    apiKey: cfg.MINIMAX_API_KEY,
  });

  const result = streamText({
    model: provider(cfg.CHAT_MODEL),
    messages: prepared.messages,
  });

  return result.toTextStreamResponse({
    headers: { "x-sources": encodeURIComponent(JSON.stringify(prepared.sources)) },
  });
}
```

- [ ] **Step 3: Verify the project type-checks and builds**

Run: `npx tsc --noEmit`
Expected: no type errors. (If `@/` alias errors, confirm `tsconfig.json` `compilerOptions.paths` has `"@/*": ["./*"]` from create-next-app.)

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts lib/runtime.ts
git commit -m "feat: streaming chat API route"
```

---

## Task 23: Frontend chat UI

**Files:**
- Create: `app/page.tsx`
- Create: `app/globals.css` (if not present from scaffold — minimal styles)
- Create: `components/Citations.tsx`
- Test: `lib/format.ts` + `lib/format.test.ts` (pure helper for rendering source labels)

- [ ] **Step 1: Write the failing test for the pure helper**

```ts
// lib/format.test.ts
import { expect, test } from "vitest";
import { sourcesFromHeader } from "./format";

test("decodes the x-sources header into an array", () => {
  const header = encodeURIComponent(JSON.stringify([{ n: 1, url: "u", title: "t" }]));
  expect(sourcesFromHeader(header)).toEqual([{ n: 1, url: "u", title: "t" }]);
});

test("returns [] for missing/garbage header", () => {
  expect(sourcesFromHeader(null)).toEqual([]);
  expect(sourcesFromHeader("%%%")).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL ("Cannot find module './format'").

- [ ] **Step 3: Write the helper**

```ts
// lib/format.ts
import type { SourceRef } from "./types";

export function sourcesFromHeader(header: string | null): SourceRef[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header));
    return Array.isArray(parsed) ? (parsed as SourceRef[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the Citations component**

```tsx
// components/Citations.tsx
import type { SourceRef } from "@/lib/types";

export function Citations({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
      <strong>Sources:</strong>
      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
        {sources.map((s) => (
          <li key={s.n}>
            [{s.n}] <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Write the chat page**

```tsx
// app/page.tsx
"use client";

import { useState } from "react";
import { Citations } from "@/components/Citations";
import { sourcesFromHeader } from "@/lib/format";
import type { ChatMessage, SourceRef } from "@/lib/types";

const EXAMPLES = [
  "Compare RSPro 600 and Lite 600",
  "Which printers suit investment casting?",
  "What is the build volume of the RSPro 2100?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      const sources = sourcesFromHeader(res.headers.get("x-sources"));
      const ct = res.headers.get("content-type") ?? "";

      if (ct.includes("application/json")) {
        const data = (await res.json()) as { answer: string; sources: SourceRef[] };
        update(data.answer, data.sources);
      } else {
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          update(acc, sources);
        }
      }
    } catch {
      update("Sorry, something went wrong. Please try again.", []);
    } finally {
      setBusy(false);
    }
  }

  function update(content: string, sources: SourceRef[]) {
    setTurns((t) => {
      const copy = [...t];
      copy[copy.length - 1] = { role: "assistant", content, sources };
      return copy;
    });
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>UnionTech 3D Assistant</h1>
      <p style={{ opacity: 0.7 }}>Ask about UnionTech printers, materials, software, and applications.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {EXAMPLES.map((q) => (
          <button key={q} onClick={() => send(q)} disabled={busy}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 16, border: "1px solid #ccc", cursor: "pointer" }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "16px 0" }}>
        {turns.map((t, i) => (
          <div key={i} style={{ alignSelf: t.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: t.role === "user" ? "#0b5fff" : "#f1f1f3", color: t.role === "user" ? "white" : "black", whiteSpace: "pre-wrap" }}>
              {t.content || (busy && i === turns.length - 1 ? "…" : "")}
            </div>
            {t.role === "assistant" && <Citations sources={t.sources ?? []} />}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }} disabled={busy} />
        <button type="submit" disabled={busy}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#0b5fff", color: "white", cursor: "pointer" }}>
          Send
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Run unit tests + type-check**

Run: `npx vitest run lib/format.test.ts && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx components/Citations.tsx lib/format.ts lib/format.test.ts
git commit -m "feat: chat UI with streaming + citations"
```

---

## Task 24: Eval harness

**Files:**
- Create: `lib/eval-core.ts`
- Create: `scripts/eval.ts`
- Create: `eval/golden.jsonl` (seed set; expand to ~60–100 after first ingest)
- Test: `lib/eval-core.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/eval-core.test.ts
import { expect, test } from "vitest";
import { isHit, scoreCase, summarize } from "./eval-core";
import type { RetrievedChunk } from "./types";

const rc = (url: string): RetrievedChunk => ({
  chunkId: "c", url, title: "t", docType: "product",
  sourceType: "html-text", headingPath: [], lastmod: null, text: "x",
  cosine: 0.9, keyword: 0.5, score: 1,
});

test("isHit true when an expected URL is in retrieved chunks", () => {
  expect(isHit(["https://x.com/a"], [rc("https://x.com/a"), rc("https://x.com/b")])).toBe(true);
  expect(isHit(["https://x.com/z"], [rc("https://x.com/a")])).toBe(false);
});

test("scoreCase handles answerable and negative cases", () => {
  // answerable case: expects a hit
  expect(scoreCase({ type: "answerable", expectedUrls: ["https://x.com/a"] }, { answerable: true, chunks: [rc("https://x.com/a")] }).pass).toBe(true);
  // negative case: must decline
  expect(scoreCase({ type: "negative", expectedUrls: [] }, { answerable: false, chunks: [] }).pass).toBe(true);
  expect(scoreCase({ type: "negative", expectedUrls: [] }, { answerable: true, chunks: [rc("https://x.com/a")] }).pass).toBe(false);
});

test("summarize computes pass rate", () => {
  const s = summarize([{ pass: true }, { pass: false }, { pass: true }]);
  expect(s.total).toBe(3);
  expect(s.passed).toBe(2);
  expect(s.rate).toBeCloseTo(2 / 3, 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/eval-core.test.ts`
Expected: FAIL ("Cannot find module './eval-core'").

- [ ] **Step 3: Write the eval core**

```ts
// lib/eval-core.ts
import type { RetrievedChunk } from "./types";

export interface GoldenCase {
  type: "answerable" | "negative";
  expectedUrls: string[];
  question?: string;
}

export interface CaseOutcome {
  answerable: boolean;
  chunks: RetrievedChunk[];
}

export function isHit(expectedUrls: string[], chunks: RetrievedChunk[]): boolean {
  const got = new Set(chunks.map((c) => c.url));
  return expectedUrls.some((u) => got.has(u));
}

export function scoreCase(gc: GoldenCase, out: CaseOutcome): { pass: boolean } {
  if (gc.type === "negative") return { pass: out.answerable === false };
  return { pass: out.answerable === true && isHit(gc.expectedUrls, out.chunks) };
}

export function summarize(results: { pass: boolean }[]): { total: number; passed: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, rate: results.length ? passed / results.length : 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/eval-core.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Seed the golden set**

Create `eval/golden.jsonl` (one JSON object per line; expand after the first real ingest):
```jsonl
{"type":"answerable","question":"What is the build volume of the RSPro 2100?","expectedUrls":["https://www.uniontech3d.com/products/rspro-2100-large-sla-printer.html"]}
{"type":"answerable","question":"Which printers are suited for investment casting?","expectedUrls":["https://www.uniontech3d.com/investment-casting.html"]}
{"type":"answerable","question":"Tell me about the Lite 600 SLA printer.","expectedUrls":["https://www.uniontech3d.com/products/lite-600-industrial-resin-sla-3d-printer.html"]}
{"type":"negative","question":"What is the best recipe for sourdough bread?","expectedUrls":[]}
{"type":"negative","question":"Who won the 2022 World Cup?","expectedUrls":[]}
```

> NOTE: the answerable URLs above are best-guess from the sitemap sample and MUST be corrected against the real index after Task 21 runs. The eval script prints mismatches so they can be fixed.

- [ ] **Step 6: Write the eval script (glue)**

```ts
// scripts/eval.ts
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
```

- [ ] **Step 7: Commit**

```bash
git add lib/eval-core.ts lib/eval-core.test.ts scripts/eval.ts eval/golden.jsonl
git commit -m "feat: retrieval eval harness + seed golden set"
```

---

## Task 25: Vercel packaging + docs + full verification

**Files:**
- Modify: `next.config.mjs`
- Create: `README.md`

- [ ] **Step 1: Force-include the data files in the function bundle**

Edit `next.config.mjs` to include the `data/` files in the chat route's traced bundle (without this, runtime `fs` reads 404 on Vercel — spec §5.2):
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/chat": ["./data/index.bin", "./data/index.meta.json"],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Write `README.md`**

```markdown
# UnionTech 3D RAG Chat Agent

Web chat agent that answers questions about uniontech3d.com using hybrid RAG
(MiniMax chat + embeddings, local vector index).

## Setup
1. `cp .env.example .env.local` and fill in `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID`.
2. `npm install`

## Build the index (one-time / on refresh)
`npm run ingest` — crawls the sitemap, extracts pages + PDFs, embeds chunks, and
writes `data/index.bin` + `data/index.meta.json` (committed to the repo).

## Evaluate retrieval
`npm run eval` — runs `eval/golden.jsonl` and prints hit-rate + refusal correctness.

## Run
`npm run dev` then open http://localhost:3000

## Test
`npm test`

## Deploy (Vercel)
Push to a Vercel-connected repo. The chat route runs on the Node.js runtime and the
`data/` index is force-included via `outputFileTracingIncludes` in `next.config.mjs`.
Set `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` in Vercel project env vars.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: ALL tests pass across `lib/**`.

- [ ] **Step 4: Type-check + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; Next.js build succeeds.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs README.md
git commit -m "chore: Vercel file tracing for index + docs"
```

- [ ] **Step 6: First real ingest + eval (requires API keys; manual)**

```bash
npm run ingest   # builds data/index.* (may take several minutes; polite crawl delay)
npm run eval     # fix eval/golden.jsonl URLs against printed mismatches, then re-run
git add data/index.bin data/index.meta.json eval/golden.jsonl
git commit -m "chore: build initial UnionTech index + corrected golden set"
```

- [ ] **Step 7: Visual confirmation (manual)**

Run `npm run dev`, open the app, ask an example question, and confirm the answer
streams and shows clickable sources. (Per project rules, use Playwright MCP for visual
confirmation of UI changes.)

---

## Self-Review (completed during planning)

**Spec coverage check** — every spec section maps to a task:
- §5.1 Ingestion → Tasks 4–8, 19–21
- §5.2 Index format + Vercel packaging → Tasks 9, 25
- §5.3 Retrieval (semantic/keyword/fusion/authority/guard) → Tasks 10–12, 14
- §5.4 Chat API (reasoning strip, citation IDs/validation) → Tasks 3, 15, 16, 22
- §5.5 Frontend → Task 23
- §5.6 Provider abstraction & config → Tasks 2, 3
- §5.7 Security/abuse controls → Task 17 (+ wired in Task 22)
- §6 Error handling → Tasks 20 (ingest), 22 (runtime)
- §7 Testing & eval → unit tests throughout; integration in Task 21; eval in Task 24
- §2a Assumptions (MiniMax embed host/GroupId, chat host/models, `<think>`) → Tasks 2, 3

**Placeholder scan** — no "TBD/handle edge cases/similar to Task N"; all steps contain runnable code. The one explicit follow-up (correcting golden-set URLs against the real index) is unavoidable and is gated behind a real ingest in Task 25 Step 6.

**Type consistency** — `Chunk`, `RetrievedChunk`, `SourceRef`, `ChatMessage`, `LoadedIndex` defined once in Task 1 and reused. `embed(texts, kind, cfg, fetchImpl)`, `complete(messages, cfg, fetchImpl)`, `retrieve(question, history, deps)`, `prepareChat(req, deps)`, `fuseAndRank(args)`, `shouldAnswer(top, query)` signatures are identical across the tasks that define and consume them. `SearchHit` is exported from `lib/vector.ts` and imported by `lib/fuse.ts`.
