import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getConfig, getRetrieveDeps } from "@/lib/runtime";
import { prepareChat } from "@/lib/chat-core";
import { TokenBucket } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const bucket = new TokenBucket(20, 0.5, Date.now()); // 20 burst, 1 per 2s refill

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!bucket.tryRemove(ip, Date.now())) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  const body = (await req.json()) as { message: string; history?: ChatMessage[] };
  const history = body.history ?? [];

  let prepared;
  try {
    prepared = await prepareChat({ message: body.message, history }, getRetrieveDeps());
  } catch (e) {
    console.error("prepareChat error:", String(e));
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }

  if (!prepared.ok) return new Response(prepared.reason, { status: 400 });

  if (!prepared.answerable) {
    return Response.json({
      answer: "I don't have that information in UnionTech's documentation.",
      sources: [],
    });
  }

  const cfg = getConfig();
  const provider = createOpenAICompatible({
    name: "minimax",
    baseURL: cfg.MINIMAX_CHAT_BASE_URL,
    apiKey: cfg.MINIMAX_API_KEY,
  });

  const result = streamText({
    model: provider(cfg.CHAT_MODEL),
    messages: prepared.messages,
  });

  return result.toTextStreamResponse({
    headers: { "x-sources": encodeURIComponent(JSON.stringify(prepared.sources)) },
  });
}
