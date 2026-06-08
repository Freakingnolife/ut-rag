import type { ChatMessage, SourceRef } from "./types";
import { checkRequestSize } from "./ratelimit";
import { retrieve, type RetrieveDeps } from "./retrieve";
import { buildMessages } from "./prompt";

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export type PrepareResult =
  | { ok: false; reason: string }
  | { ok: true; answerable: false; sources: SourceRef[] }
  | { ok: true; answerable: true; messages: ChatMessage[]; sources: SourceRef[] };

export async function prepareChat(req: ChatRequest, deps: RetrieveDeps): Promise<PrepareResult> {
  const size = checkRequestSize(req.message, req.history);
  if (!size.ok) return { ok: false, reason: size.reason ?? "invalid request" };

  const { chunks, answerable } = await retrieve(req.message, req.history, deps);
  if (!answerable) return { ok: true, answerable: false, sources: [] };

  const { messages, sources } = buildMessages(req.history, req.message, chunks);
  return { ok: true, answerable: true, messages, sources };
}
