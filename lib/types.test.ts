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
