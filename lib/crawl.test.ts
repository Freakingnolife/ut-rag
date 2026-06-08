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
