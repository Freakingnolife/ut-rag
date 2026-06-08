import type { Config } from "./config";
import type { ChatMessage } from "./types";

export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
}

export async function embed(
  texts: string[],
  kind: "db" | "query",
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][]> {
  const groupParam = cfg.MINIMAX_GROUP_ID
    ? `?GroupId=${encodeURIComponent(cfg.MINIMAX_GROUP_ID)}`
    : "";
  const url = `${cfg.MINIMAX_EMBED_BASE_URL}/embeddings${groupParam}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({ model: cfg.EMBED_MODEL, texts, type: kind }),
  });
  if (!res.ok) throw new Error(`MiniMax embeddings error: ${res.status}`);
  const data = (await res.json()) as { vectors?: number[][] };
  if (!data.vectors) throw new Error("MiniMax embeddings: response missing 'vectors'");
  return data.vectors;
}

export async function complete(
  messages: ChatMessage[],
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(`${cfg.MINIMAX_CHAT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({ model: cfg.CHAT_MODEL, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`MiniMax chat error: ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return stripReasoning(data.choices?.[0]?.message?.content ?? "");
}
