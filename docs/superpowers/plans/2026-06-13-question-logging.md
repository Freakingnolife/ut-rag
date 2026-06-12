# Question Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit one structured JSON line per answered (or refused) chat question to stdout, so the questions can be collected as a training/eval dataset.

**Architecture:** A new `lib/qlog.ts` owns one job — format a question-record as JSON and log it, isolating its own failures. The chat route generates a `requestId` per request and calls it at exactly two points: the refusal early-return, and `streamText`'s `onFinish` callback for the answered path.

**Tech Stack:** TypeScript, Next.js 16 (Node runtime), `ai@6.0.197` (`streamText` / `onFinish`), vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-question-logging-design.md`

---

### Task 1: `lib/qlog.ts` — format + log a question record

**Files:**
- Create: `lib/qlog.ts`
- Test: `lib/qlog.test.ts`

`SourceRef` already exists in `lib/types.ts` (`{ n: number; url: string; title: string }`). Reuse it — do not redefine.

- [ ] **Step 1: Write the failing test**

Create `lib/qlog.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatQuestionLog, logQuestion, type QuestionLogRecord } from "./qlog";

const baseRecord: QuestionLogRecord = {
  ts: "2026-06-13T12:00:00.000Z",
  requestId: "req-1",
  question: "What is UnionTech 3D?",
  answered: true,
  answer: "It is a 3D printing company.",
  sources: [{ n: 1, url: "https://uniontech3d.com/", title: "Home" }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatQuestionLog", () => {
  it("emits a single-line JSON string with a leading type marker", () => {
    const line = formatQuestionLog(baseRecord);
    expect(line).not.toContain("\n");
    expect(line.startsWith('{"type":"qlog"')).toBe(true);
  });

  it("round-trips every field through JSON.parse", () => {
    const parsed = JSON.parse(formatQuestionLog(baseRecord));
    expect(parsed).toEqual({ type: "qlog", ...baseRecord });
  });

  it("preserves the refusal case (answered:false, empty sources)", () => {
    const refusal: QuestionLogRecord = {
      ...baseRecord,
      answered: false,
      answer: "I don't have that information in UnionTech's documentation.",
      sources: [],
    };
    const parsed = JSON.parse(formatQuestionLog(refusal));
    expect(parsed.answered).toBe(false);
    expect(parsed.sources).toEqual([]);
  });
});

describe("logQuestion", () => {
  it("writes the formatted line to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logQuestion(baseRecord);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(formatQuestionLog(baseRecord));
  });

  it("never throws, even if console.log throws", () => {
    vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("drain down");
    });
    expect(() => logQuestion(baseRecord)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- qlog`
Expected: FAIL — `./qlog` cannot be resolved / `formatQuestionLog is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/qlog.ts`:

```ts
import type { SourceRef } from "./types";

export interface QuestionLogRecord {
  ts: string; // ISO timestamp
  requestId: string;
  question: string;
  answered: boolean; // false on the refusal path
  answer: string;
  sources: SourceRef[];
}

// Serialize a question record as a single-line JSON string. The leading
// `type: "qlog"` marker makes records filterable in the Vercel log drain.
export function formatQuestionLog(record: QuestionLogRecord): string {
  return JSON.stringify({ type: "qlog", ...record });
}

// Fire-and-forget. Swallows its own errors so logging can never break the
// request path.
export function logQuestion(record: QuestionLogRecord): void {
  try {
    console.log(formatQuestionLog(record));
  } catch {
    // Intentionally ignored — logging must not affect the response.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- qlog`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/qlog.ts lib/qlog.test.ts
git commit -m "feat: question log formatter + logger"
```

---

### Task 2: Wire `logQuestion` into the chat route

**Files:**
- Modify: `app/api/chat/route.ts`

There is no unit test for the route (it is a Next.js route handler — consistent with the rest of the repo, the route wiring is verified by `tsc` + the dev server, not vitest). The logic under test lives in `lib/qlog.ts`, already covered in Task 1.

- [ ] **Step 1: Import `logQuestion`**

In `app/api/chat/route.ts`, add to the imports near the top (after the existing `@/lib/...` imports, e.g. after line 6):

```ts
import { logQuestion } from "@/lib/qlog";
```

- [ ] **Step 2: Generate a request id once per request**

Inside `POST`, immediately after the rate-limit check passes — insert right before `let body:` (currently line 37):

```ts
  const requestId = crypto.randomUUID();
```

(`crypto` is a global in the Node.js runtime; no import needed.)

- [ ] **Step 3: Log the refusal path**

Replace the existing refusal block (currently lines 55-60):

```ts
  if (!prepared.answerable) {
    return Response.json({
      answer: "I don't have that information in UnionTech's documentation.",
      sources: [],
    });
  }
```

with:

```ts
  if (!prepared.answerable) {
    const answer = "I don't have that information in UnionTech's documentation.";
    logQuestion({
      ts: new Date().toISOString(),
      requestId,
      question: body.message,
      answered: false,
      answer,
      sources: [],
    });
    return Response.json({ answer, sources: [] });
  }
```

- [ ] **Step 4: Log the answered path via `onFinish`**

Replace the `streamText({ ... })` call (currently lines 69-72):

```ts
  const result = streamText({
    model: provider(cfg.CHAT_MODEL),
    messages: prepared.messages,
  });
```

with:

```ts
  const result = streamText({
    model: provider(cfg.CHAT_MODEL),
    messages: prepared.messages,
    onFinish: ({ text }) => {
      logQuestion({
        ts: new Date().toISOString(),
        requestId,
        question: body.message,
        answered: true,
        answer: text,
        sources: prepared.sources,
      });
    },
  });
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`onFinish`'s event is typed `StreamTextOnFinishCallback` → `OnFinishEvent` which extends `StepResult` with `readonly text: string`, so `{ text }` destructures cleanly in `ai@6.0.197`.)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions; the qlog suite from Task 1 included.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"What is UnionTech 3D?"}' >/dev/null
```

Expected: a `{"type":"qlog",...,"answered":true,...}` line appears in the dev server's stdout. Then repeat with an off-topic question (e.g. `"What is the capital of France?"`) and confirm a line with `"answered":false`.

- [ ] **Step 8: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: log every chat question to stdout"
```

---

## Self-Review

- **Spec coverage:** stdout JSON destination (Task 1 `formatQuestionLog`), all six fields incl. answer+sources+answerability (record shape, Task 1), no identifier (record has no IP/session — Task 1 interface), `onFinish` capture (Task 2 Step 4), two log points incl. refusal (Task 2 Steps 3-4), the four NOT-logged paths left untouched (Task 2 modifies only the refusal block and the `streamText` call — 429/400/500 returns are not edited), failure isolation (Task 1 `logQuestion` try/catch + test), TDD test-first (Task 1 Steps 1-2). All covered.
- **Placeholder scan:** none — every code/command step is concrete.
- **Type consistency:** `QuestionLogRecord` fields used identically in Tasks 1 and 2; `SourceRef` reused from `lib/types.ts`; `formatQuestionLog`/`logQuestion` names consistent throughout.
