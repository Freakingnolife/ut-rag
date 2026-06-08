import { expect, test } from "vitest";
import { TokenBucket, checkRequestSize } from "./ratelimit";
import type { ChatMessage } from "./types";

test("TokenBucket allows up to capacity then blocks until refill", () => {
  const bucket = new TokenBucket(2, 1, 1000); // capacity 2, 1 token/sec, start t=1000ms
  expect(bucket.tryRemove("ip", 1000)).toBe(true);
  expect(bucket.tryRemove("ip", 1000)).toBe(true);
  expect(bucket.tryRemove("ip", 1000)).toBe(false); // empty
  expect(bucket.tryRemove("ip", 2000)).toBe(true);  // +1s refills 1
});

test("separate keys have separate buckets", () => {
  const bucket = new TokenBucket(1, 1, 0);
  expect(bucket.tryRemove("a", 0)).toBe(true);
  expect(bucket.tryRemove("b", 0)).toBe(true);
});

test("checkRequestSize rejects overly long messages or history", () => {
  const longMsg = "x".repeat(9000);
  expect(checkRequestSize(longMsg, []).ok).toBe(false);
  const many: ChatMessage[] = Array(50).fill({ role: "user", content: "hi" });
  expect(checkRequestSize("ok", many).ok).toBe(false);
  expect(checkRequestSize("ok", []).ok).toBe(true);
});
