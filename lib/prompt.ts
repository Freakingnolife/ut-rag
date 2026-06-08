import type { ChatMessage, RetrievedChunk, SourceRef } from "./types";

export function buildSystemPrompt(): string {
  return [
    "You are UnionTech's product assistant. Answer ONLY using the provided context.",
    "If the context does not contain the answer, say you don't have that information.",
    "Never invent specifications, model names, or numbers.",
    "Cite every factual claim with the matching source label in square brackets, e.g. [1] or [2].",
    "Use the form [n] where n is a source number from the context.",
  ].join(" ");
}

export function buildContext(chunks: RetrievedChunk[]): { context: string; sources: SourceRef[] } {
  const sources: SourceRef[] = chunks.map((c, i) => ({ n: i + 1, url: c.url, title: c.title }));
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.title} — ${c.url})\n${c.text}`)
    .join("\n\n");
  return { context, sources };
}

export function buildMessages(
  history: ChatMessage[],
  question: string,
  chunks: RetrievedChunk[],
): { messages: ChatMessage[]; sources: SourceRef[] } {
  const { context, sources } = buildContext(chunks);
  const messages: ChatMessage[] = [
    { role: "system", content: `${buildSystemPrompt()}\n\nContext:\n${context}` },
    ...history,
    { role: "user", content: question },
  ];
  return { messages, sources };
}
