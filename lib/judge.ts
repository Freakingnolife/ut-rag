import type { ChatMessage, RetrievedChunk } from "./types";

export interface Verdict {
  correct: boolean;
  reason: string;
}

// Builds an LLM-judge prompt that grades faithfulness + responsiveness: the answer must
// directly address the question AND be supported by the retrieved context (no invented
// specs, models, or claims). A refusal or off-topic reply is incorrect.
export function buildJudgePrompt(
  question: string,
  answer: string,
  context: RetrievedChunk[],
): ChatMessage[] {
  const ctx = context.map((c, i) => `[${i + 1}] ${c.url}\n${c.text}`).join("\n\n");
  return [
    {
      role: "system",
      content:
        "You are a strict QA grader for a retrieval-augmented assistant that answers questions " +
        "about UnionTech industrial 3D printers. Given a QUESTION, the assistant's ANSWER, and the " +
        "retrieved CONTEXT, decide whether the answer is CORRECT: it must directly answer the " +
        "question AND be supported by the context — no invented specs, models, or claims. A refusal, " +
        "an evasion, or an off-topic reply is INCORRECT. Reply with exactly one line " +
        "'VERDICT: PASS' or 'VERDICT: FAIL', then a one-sentence reason.",
    },
    {
      role: "user",
      content: `QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nCONTEXT:\n${ctx}`,
    },
  ];
}

// Parses the judge's reply. Absent an explicit verdict token we fail closed — an unparseable
// grade should never be counted as a pass.
export function parseVerdict(raw: string): Verdict {
  const m = raw.match(/VERDICT:\s*(PASS|FAIL)/i);
  const correct = m ? m[1].toUpperCase() === "PASS" : false;
  const reason = raw.replace(/VERDICT:\s*(PASS|FAIL)/i, "").replace(/^[\s—–:-]+/, "").trim();
  return { correct, reason };
}
