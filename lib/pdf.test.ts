import { expect, test } from "vitest";
import { pdfToText } from "./pdf";

test("joins extracted page texts with blank lines", async () => {
  const fakeExtract = async (_data: Uint8Array) => ({ text: ["Page one", "Page two"] });
  const out = await pdfToText(new Uint8Array([1, 2, 3]), fakeExtract as any);
  expect(out).toBe("Page one\n\nPage two");
});

test("handles a single string text result", async () => {
  const fakeExtract = async (_data: Uint8Array) => ({ text: "Only page" });
  const out = await pdfToText(new Uint8Array([1]), fakeExtract as any);
  expect(out).toBe("Only page");
});
