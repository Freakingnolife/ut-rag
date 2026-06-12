import type { SourceRef } from "./types";

export interface QuestionLogRecord {
  ts: string;
  requestId: string;
  question: string;
  answered: boolean;
  answer: string;
  sources: SourceRef[];
}

export function formatQuestionLog(record: QuestionLogRecord): string {
  return JSON.stringify({ type: "qlog", ...record });
}

export function logQuestion(record: QuestionLogRecord): void {
  try {
    console.log(formatQuestionLog(record));
  } catch {
    // Intentionally ignored — logging must not affect the response.
  }
}
