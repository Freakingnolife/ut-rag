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

test("estimateTokens counts CJK chars as one token each", () => {
  expect(estimateTokens("光固化打印机")).toBe(6);
});

test("estimateTokens keeps ~4 chars per token for Latin text", () => {
  expect(estimateTokens("12345678")).toBe(2);
});
