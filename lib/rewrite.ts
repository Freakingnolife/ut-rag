import type { ChatMessage } from "./types";

export type CompleteFn = (messages: ChatMessage[]) => Promise<string>;

// Words whose referent lives in a previous turn — their presence means the question can't
// be retrieved as-is.
const ANAPHORA = new Set([
  "it", "its", "it's", "they", "them", "their", "theirs", "that", "this", "these",
  "those", "one", "ones", "he", "she", "him", "her", "his", "hers",
]);

// A follow-up only needs the (LLM round-trip) rewrite when it actually depends on prior
// turns: it opens with a continuation, carries an anaphor, or is a bare fragment. A
// self-contained question ("What resin does the Lite 600 use?") retrieves fine on its own,
// so we skip the rewrite and save ~1.5-2s. CJK / empty falls through to rewrite (safe default).
export function needsContext(question: string): boolean {
  const words = question.trim().toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (words.length === 0) return true;
  if (words[0] === "and" || words[0] === "or" || words[0] === "also" || words[0] === "plus") return true;
  if (words[0] === "what" && words[1] === "about") return true;
  if (words.length <= 3) return true;
  return words.some((w) => ANAPHORA.has(w));
}

export async function rewriteQuery(
  history: ChatMessage[],
  question: string,
  complete: CompleteFn,
): Promise<string> {
  if (history.length === 0) return question;
  if (!needsContext(question)) return question;

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
