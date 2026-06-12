import { expect, test } from "vitest";
import { buildSystemPrompt, buildContext, buildMessages } from "./prompt";
import type { RetrievedChunk, ChatMessage } from "./types";

const chunks: RetrievedChunk[] = [
  { chunkId: "c0", url: "https://x.com/a", title: "A", docType: "product", sourceType: "html-table", headingPath: [], lastmod: null, text: "Build Volume: 600mm", cosine: 0.9, keyword: 0.5, score: 1 },
  { chunkId: "c1", url: "https://x.com/b", title: "B", docType: "product", sourceType: "html-text", headingPath: [], lastmod: null, text: "Laser: 355nm", cosine: 0.8, keyword: 0.4, score: 0.9 },
];

test("system prompt forbids fabrication and requires citations", () => {
  const p = buildSystemPrompt();
  expect(p.toLowerCase()).toContain("only");
  expect(p).toContain("[n]");
});

test("system prompt instructs model to always respond in the user's language", () => {
  const p = buildSystemPrompt();
  // Must have a general language-mirroring rule separate from the decline clause.
  // Strip the decline sentence so we don't match the narrow "Decline in the language..." clause.
  const withoutDecline = p.replace(/[^.]*[Dd]ecline[^.]*\./g, "");
  expect(withoutDecline).toMatch(/respond.+language|language.+user (wrote|asked|used|input|types?)/i);
});

test("system prompt forbids inferring a product's technology/category from list adjacency", () => {
  const p = buildSystemPrompt().toLowerCase();
  // The over-claim failures all came from attributing a technology/category to a
  // model that merely appeared in a list or near a heading. The prompt must require
  // an explicit per-product statement and reject adjacency as evidence.
  expect(p).toMatch(/explicit/);
  expect(p).toMatch(/technolog|categor/);
  expect(p).toMatch(/list|near|heading|appears|proximity/);
});

test("buildContext numbers sources 1..k and returns aligned source refs", () => {
  const { context, sources } = buildContext(chunks);
  expect(context).toContain("[1]");
  expect(context).toContain("https://x.com/a");
  expect(sources).toEqual([
    { n: 1, url: "https://x.com/a", title: "A" },
    { n: 2, url: "https://x.com/b", title: "B" },
  ]);
});

test("buildMessages places system + context + history + question", () => {
  const history: ChatMessage[] = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }];
  const { messages } = buildMessages(history, "build volume?", chunks);
  expect(messages[0].role).toBe("system");
  expect(messages.some((m) => m.content.includes("build volume?"))).toBe(true);
});

test("buildMessages restates the language rule after the context", () => {
  const { messages } = buildMessages([], "build volume?", chunks);
  const system = messages[0].content;
  const contextAt = system.indexOf("Context:");
  // A language-enforcement reminder must appear AFTER the context block, so it
  // isn't out-weighed by source text in another language (e.g. Chinese).
  const reminder = system.slice(contextAt).match(/respond in the (?:same )?language/i);
  expect(contextAt).toBeGreaterThanOrEqual(0);
  expect(reminder).not.toBeNull();
});
