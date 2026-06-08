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
