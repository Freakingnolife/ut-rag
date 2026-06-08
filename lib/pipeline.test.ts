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
