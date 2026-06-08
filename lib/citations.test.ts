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
