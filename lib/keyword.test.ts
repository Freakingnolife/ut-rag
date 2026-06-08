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
