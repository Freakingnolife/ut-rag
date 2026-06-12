import { expect, test } from "vitest";
import { parseMarkdown } from "./markdown";

test("a single line is one paragraph block with one text span", () => {
  expect(parseMarkdown("Hello world.")).toEqual([
    { type: "p", spans: [{ kind: "text", text: "Hello world." }] },
  ]);
});

test("a blank line separates paragraphs", () => {
  expect(parseMarkdown("First para.\n\nSecond para.")).toEqual([
    { type: "p", spans: [{ kind: "text", text: "First para." }] },
    { type: "p", spans: [{ kind: "text", text: "Second para." }] },
  ]);
});

test("consecutive '- ' lines group into one ul block with inline-parsed items", () => {
  expect(parseMarkdown("- First\n- **Second**\n- Third [1]")).toEqual([
    {
      type: "ul",
      items: [
        [{ kind: "text", text: "First" }],
        [{ kind: "bold", text: "Second" }],
        [{ kind: "text", text: "Third " }, { kind: "cite", n: 1 }],
      ],
    },
  ]);
});

test("# and ## produce heading blocks with their level", () => {
  expect(parseMarkdown("# Title\n## Subtitle")).toEqual([
    { type: "heading", level: 1, spans: [{ kind: "text", text: "Title" }] },
    { type: "heading", level: 2, spans: [{ kind: "text", text: "Subtitle" }] },
  ]);
});

test("[n] becomes a cite span with a numeric value", () => {
  expect(parseMarkdown("See [2] and [10].")).toEqual([
    {
      type: "p",
      spans: [
        { kind: "text", text: "See " },
        { kind: "cite", n: 2 },
        { kind: "text", text: " and " },
        { kind: "cite", n: 10 },
        { kind: "text", text: "." },
      ],
    },
  ]);
});

test("**bold** splits a paragraph into text and bold spans", () => {
  expect(parseMarkdown("The **RSPro 2100** is large.")).toEqual([
    {
      type: "p",
      spans: [
        { kind: "text", text: "The " },
        { kind: "bold", text: "RSPro 2100" },
        { kind: "text", text: " is large." },
      ],
    },
  ]);
});
