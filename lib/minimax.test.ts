import { expect, test } from "vitest";
import { stripReasoning, embed, complete } from "./minimax";
import type { Config } from "./config";

const cfg: Config = {
  MINIMAX_API_KEY: "key",
  MINIMAX_GROUP_ID: "group",
  MINIMAX_CHAT_BASE_URL: "https://chat.example/v1",
  MINIMAX_EMBED_BASE_URL: "https://embed.example/v1",
  CHAT_MODEL: "MiniMax-M2",
  EMBED_MODEL: "embo-01",
};

test("stripReasoning removes <think> blocks", () => {
  expect(stripReasoning("<think>reason</think>Hello")).toBe("Hello");
  expect(stripReasoning("plain")).toBe("plain");
  expect(stripReasoning("<think>a\nb</think>\nAnswer")).toBe("Answer");
});

test("embed posts to embed host with GroupId and returns vectors", async () => {
  let captured: { url: string; body: any } | null = null;
  const fakeFetch = async (url: string, init: any) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ vectors: [[0.1, 0.2]] }), { status: 200 });
  };
  const out = await embed(["hi"], "query", cfg, fakeFetch as any);
  expect(out).toEqual([[0.1, 0.2]]);
  expect(captured!.url).toBe("https://embed.example/v1/embeddings?GroupId=group");
  expect(captured!.body).toEqual({ model: "embo-01", texts: ["hi"], type: "query" });
});

test("embed throws on non-ok", async () => {
  const fakeFetch = async () => new Response("nope", { status: 500 });
  await expect(embed(["hi"], "db", cfg, fakeFetch as any)).rejects.toThrow();
});

test("complete posts to chat host and strips reasoning", async () => {
  const fakeFetch = async (url: string) => {
    expect(url).toBe("https://chat.example/v1/chat/completions");
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "<think>x</think>Done" } }] }),
      { status: 200 },
    );
  };
  const out = await complete([{ role: "user", content: "q" }], cfg, fakeFetch as any);
  expect(out).toBe("Done");
});
