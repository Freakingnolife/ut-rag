import { expect, test } from "vitest";
import { tokenize, tokenizeQuery, keywordScores, hasExactModelMatch } from "./keyword";
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

test("tokenize splits concatenated model names at letter-digit boundaries", () => {
  expect(tokenize("Lite600")).toEqual(["lite600", "lite", "600"]);
  expect(tokenize("RD3000")).toEqual(["rd3000", "rd", "3000"]);
});

test("tokenize keeps short letter-digit runs intact", () => {
  expect(tokenize("3d")).toEqual(["3d"]);
});

test("tokenizeQuery drops colloquial fillers", () => {
  expect(tokenizeQuery("do yall do dental stuff")).toEqual(["dental"]);
});

test("tokenize emits bigrams for CJK runs", () => {
  expect(tokenize("光固化3D打印机")).toEqual(["光固", "固化", "3d", "打印", "印机"]);
});

test("tokenize keeps a lone CJK char as a single token", () => {
  expect(tokenize("墙")).toEqual(["墙"]);
});

test("keywordScores matches Chinese queries against Chinese chunks", () => {
  const records = [mk("工业级光固化3D打印机，成型尺寸大"), mk("dental resin colors")];
  const scores = keywordScores(records, "光固化打印机");
  expect(scores[0]).toBeGreaterThan(scores[1]);
  expect(scores[1]).toBe(0);
});

test("hasExactModelMatch detects digit-bearing tokens present in chunk", () => {
  expect(hasExactModelMatch(mk("the rspro 2100 has..."), "specs of rspro 2100")).toBe(true);
  expect(hasExactModelMatch(mk("dental resin"), "specs of rspro 2100")).toBe(false);
});
