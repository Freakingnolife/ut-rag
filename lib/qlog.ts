import type { SourceRef } from "./types";

export interface QuestionLogRecord {
  ts: string;
  requestId: string;
  question: string;
  answered: boolean;
  answer: string;
  sources: SourceRef[];
  streamError?: true;
}

export function formatQuestionLog(record: QuestionLogRecord): string {
  return JSON.stringify({ ...record, type: "qlog" as const });
}

export function logQuestion(record: QuestionLogRecord): void {
  try {
    console.log(formatQuestionLog(record));
  } catch {
    // Intentionally ignored — logging must not affect the response.
  }
}
