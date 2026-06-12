# Question Logging — Design

**Date:** 2026-06-13
**Status:** Approved (design), pending implementation

## Goal

Keep a durable record of every question the chat agent answers, so the records
can later be used to evaluate and improve answer quality and knowledge-base
coverage.

## Constraint

The app deploys on **Vercel serverless** (Node runtime). The local filesystem is
ephemeral and not shared across instances, so a record that survives the request
cannot be written to a local file. The record is emitted as a single structured
JSON line to **stdout**, captured by Vercel logs / a log drain.

## Decisions

| Decision | Choice |
|---|---|
| Storage destination | Structured JSON line to stdout (Vercel log drain) |
| Fields captured | question, answer, sources, answerability, timestamp, request id |
| User identifier | **None** — no IP, no session, no history (avoids storing PII) |
| Streamed-answer capture | `streamText`'s `onFinish` callback (no manual buffering) |

## Architecture

### New module — `lib/qlog.ts` (+ `lib/qlog.test.ts`)

One job: turn a question-record into a single structured JSON line and emit it.

```ts
interface QuestionLogRecord {
  ts: string;          // ISO timestamp
  requestId: string;   // crypto.randomUUID()
  question: string;    // raw user message
  answered: boolean;   // false = refusal path
  answer: string;      // full answer text, or the refusal sentence
  sources: SourceRef[]; // { n, url, title }[] — same shape as x-sources
}

formatQuestionLog(record: QuestionLogRecord): string  // pure; returns JSON string
logQuestion(record: QuestionLogRecord): void          // console.log wrapper, self-isolating
```

- `formatQuestionLog` returns the JSON string with a stable `type: "qlog"` marker
  as the first key, so records are filterable in the log drain. This is the
  function under test.
- `logQuestion` is a thin wrapper that `console.log`s the formatted line, wrapped
  so any logging failure is swallowed and can never throw into the request path.

### Record shape (emitted)

```json
{
  "type": "qlog",
  "ts": "2026-06-13T12:00:00.000Z",
  "requestId": "uuid",
  "question": "<user message>",
  "answered": true,
  "answer": "<full answer or refusal text>",
  "sources": [{ "n": 1, "url": "...", "title": "..." }]
}
```

### Wiring — `app/api/chat/route.ts`

Generate `requestId = crypto.randomUUID()` once per request. Two — and only
two — log points:

1. **Refusal path** (`!prepared.answerable`): log immediately with
   `answered: false`, `answer` = the "I don't have that information in
   UnionTech's documentation." sentence, `sources: []`. High-signal for
   knowledge-base gaps.
2. **Answerable path**: pass `onFinish: ({ text }) => logQuestion({...})` to
   `streamText`, logging `answered: true`, `answer: text`,
   `sources: prepared.sources`.

### Deliberately NOT logged

Logging only happens for questions the system actually answered or explicitly
refused. The following early-return paths are **not** logged — they do not
represent an answered question and would pollute the dataset:

- Rate-limited (429)
- Invalid request body (400)
- Validation-rejected question (`!prepared.ok`, 400)
- `prepareChat` failure (500)

A separate error/abuse log, if ever wanted, is its own feature.

## Failure isolation

`logQuestion` swallows its own errors. Logging is fire-and-forget: it never
delays, blocks, or breaks the chat response. The `onFinish` callback runs after
the stream completes, so it does not affect streaming latency.

## Testing

`lib/qlog.test.ts` pins `formatQuestionLog` (TDD — test first, RED, then the
module):

- Correct keys present, `type: "qlog"` marker is the first key.
- `answered: true` case and `answered: false` (refusal) case.
- Output round-trips through `JSON.parse` back to the record.
- `sources` array is preserved (including empty array on the refusal path).

The route wiring is verified manually (it is a Next.js route, not unit-tested),
consistent with the rest of the codebase.

## Out of scope

- Querying/exporting the dataset from the log drain (downstream concern).
- Persisting to a managed DB or external logging service (rejected for now —
  stdout is the chosen destination).
- Any user identifier, session correlation, or conversation history.
