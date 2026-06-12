import { expect, test } from "vitest";
import { rewriteQuery, needsContext } from "./rewrite";
import type { ChatMessage } from "./types";

test("returns the question unchanged when there is no history", async () => {
  const out = await rewriteQuery([], "What is the build volume?", async () => "SHOULD NOT CALL");
  expect(out).toBe("What is the build volume?");
});

test("needsContext flags anaphora, continuations and short fragments, passes standalone questions", () => {
  expect(needsContext("and its build volume?")).toBe(true);   // continuation + anaphora
  expect(needsContext("Does it support metal?")).toBe(true);  // anaphora
  expect(needsContext("what about the price?")).toBe(true);   // continuation phrase
  expect(needsContext("specs?")).toBe(true);                  // short fragment
  expect(needsContext("Lite600打印效果怎么样？")).toBe(true);   // CJK → rewrite (safe default)
  expect(needsContext("What is the build volume of the RSPro 2100?")).toBe(false);
  expect(needsContext("How much does the Lite 600 cost?")).toBe(false);
});

test("skips the completion for a standalone follow-up even when history exists", async () => {
  const history: ChatMessage[] = [
    { role: "user", content: "Tell me about the RSPro 2100." },
    { role: "assistant", content: "It is a large SLA printer." },
  ];
  const out = await rewriteQuery(history, "What resin materials does the Lite 600 support?", async () => "SHOULD NOT CALL");
  expect(out).toBe("What resin materials does the Lite 600 support?");
});

test("uses the completion to produce a standalone query when history exists", async () => {
  const history: ChatMessage[] = [
    { role: "user", content: "Tell me about the RSPro 2100." },
    { role: "assistant", content: "It is a large SLA printer." },
  ];
  let seen = "";
  const fakeComplete = async (msgs: ChatMessage[]) => {
    seen = msgs[msgs.length - 1].content;
    return "RSPro 2100 build volume";
  };
  const out = await rewriteQuery(history, "and its build volume?", fakeComplete);
  expect(out).toBe("RSPro 2100 build volume");
  expect(seen).toContain("and its build volume?");
});
