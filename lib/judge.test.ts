import { expect, test } from "vitest";
import { buildJudgePrompt, parseVerdict } from "./judge";
import type { RetrievedChunk } from "./types";

const ctx: RetrievedChunk[] = [
  { chunkId: "c0", url: "https://x/products/lite-600.html", title: "Lite 600", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "Build volume 600x600x400mm", cosine: 0.8, keyword: 1, score: 1 },
];

test("buildJudgePrompt includes the question, answer, context and a strict verdict instruction", () => {
  const msgs = buildJudgePrompt("What is the build volume of the Lite 600?", "It is 600x600x400mm.", ctx);
  expect(msgs[0].role).toBe("system");
  expect(msgs[0].content).toContain("VERDICT");
  const user = msgs[msgs.length - 1].content;
  expect(user).toContain("What is the build volume of the Lite 600?");
  expect(user).toContain("600x600x400mm");
  expect(user).toContain("https://x/products/lite-600.html");
});

test("parseVerdict reads PASS/FAIL case-insensitively and keeps the reason", () => {
  expect(parseVerdict("VERDICT: PASS\nThe answer matches the context.").correct).toBe(true);
  expect(parseVerdict("verdict: fail — it invented a spec").correct).toBe(false);
  expect(parseVerdict("VERDICT: PASS").reason).toBe("");
});

test("parseVerdict defaults to FAIL when no verdict token is present", () => {
  expect(parseVerdict("I think the answer is fine").correct).toBe(false);
});
