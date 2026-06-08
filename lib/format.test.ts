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
