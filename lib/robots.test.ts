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
