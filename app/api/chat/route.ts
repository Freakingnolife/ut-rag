import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { z } from "zod";
import { getConfig, getRetrieveDeps } from "@/lib/runtime";
import { prepareChat } from "@/lib/chat-core";
import { TokenBucket } from "@/lib/ratelimit";
import { logQuestion } from "@/lib/qlog";

export const runtime = "nodejs";

// Persists per warm Vercel function instance only — not shared across instances or regions.
// For production-grade rate limiting, use a shared store (Redis/KV) or a WAF/edge limiter.
const bucket = new TokenBucket(20, 0.5, Date.now()); // 20 burst, 1 per 2s refill

const ChatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });
const BodySchema = z.object({
  message: z.string().min(1).max(8000),
  history: z.array(ChatMessageSchema).max(30).optional().default([]),
});

// Prefer infrastructure-set headers over client-supplied x-forwarded-for (spoofable).
// Note: x-forwarded-for is still a best-effort fallback on platforms without CF/nginx.
function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon"
  );
}

export async function POST(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!bucket.tryRemove(ip, Date.now())) {
    return new Response("Rate limit exceeded. Please slow down.", { status: 429 });
  }

  const requestId = crypto.randomUUID();
  const ts = new Date().toISOString();

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  const history = body.history;

  let prepared;
  try {
    prepared = await prepareChat({ message: body.message, history }, getRetrieveDeps());
  } catch (e) {
    console.error("prepareChat error:", String(e));
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }

  if (!prepared.ok) return new Response(prepared.reason, { status: 400 });

  if (!prepared.answerable) {
    const answer = "I don't have that information in UnionTech's documentation.";
    logQuestion({
      ts,
      requestId,
      question: body.message,
      answered: false,
      answer,
      sources: [],
    });
    return Response.json({ answer, sources: [] });
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
    onFinish: ({ text }) => {
      logQuestion({
        ts,
        requestId,
        question: body.message,
        answered: true,
        answer: text,
        sources: prepared.sources,
      });
    },
    onError: ({ error }) => {
      console.error("streamText error", requestId, String(error));
      logQuestion({
        ts,
        requestId,
        question: body.message,
        answered: false,
        answer: "",
        sources: [],
        streamError: true,
      });
    },
  });

  return result.toTextStreamResponse({
    headers: { "x-sources": encodeURIComponent(JSON.stringify(prepared.sources)) },
  });
}
