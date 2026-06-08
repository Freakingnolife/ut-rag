import type { ChatMessage } from "./types";

export type CompleteFn = (messages: ChatMessage[]) => Promise<string>;

export async function rewriteQuery(
  history: ChatMessage[],
  question: string,
  complete: CompleteFn,
): Promise<string> {
  if (history.length === 0) return question;

  const convo = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content.replace(/\n/g, " ")}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Rewrite the user's latest message into a single standalone search query " +
        "using the conversation for context. Output ONLY the query, no preamble.",
    },
    { role: "user", content: `Conversation:\n${convo}\n\nLatest message: ${question}\n\nStandalone query:` },
  ];

  const out = (await complete(messages)).trim();
  return out || question;
}
