import { expect, test } from "vitest";
import { prepareChat } from "./chat-core";
import type { Chunk, LoadedIndex, ChatMessage } from "./types";

const records: Chunk[] = [
  { chunkId: "c0", url: "u0", title: "RSPro 2100", docType: "product", sourceType: "html-table", headingPath: [], lastmod: "2026-01-01", text: "Build Volume: 600x600x400 mm rspro 2100" },
];
const index: LoadedIndex = { dim: 2, records, matrix: new Float32Array([1, 0]) };

const baseDeps = {
  index,
  embedQuery: async (_q: string) => [1, 0],
  complete: async (_m: ChatMessage[]) => "unused",
  nowIso: "2026-06-09T00:00:00Z",
};

test("rejects oversized message", async () => {
  const res = await prepareChat({ message: "x".repeat(9000), history: [] }, baseDeps);
  expect(res.ok).toBe(false);
});

test("returns decline payload when not answerable", async () => {
  const res = await prepareChat(
    { message: "bake bread", history: [] },
    { ...baseDeps, embedQuery: async () => [-1, -1] },
  );
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.answerable).toBe(false);
});

test("returns messages + sources when answerable", async () => {
  const res = await prepareChat({ message: "rspro 2100 build volume", history: [] }, baseDeps);
  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.answerable).toBe(true);
    expect(res.sources[0].url).toBe("u0");
    expect(res.messages[0].role).toBe("system");
  }
});
