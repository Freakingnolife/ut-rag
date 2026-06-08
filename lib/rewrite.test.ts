import { expect, test } from "vitest";
import { rewriteQuery } from "./rewrite";
import type { ChatMessage } from "./types";

test("returns the question unchanged when there is no history", async () => {
  const out = await rewriteQuery([], "What is the build volume?", async () => "SHOULD NOT CALL");
  expect(out).toBe("What is the build volume?");
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
