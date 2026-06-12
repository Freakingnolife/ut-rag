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
  it("emits a single-line JSON string with type:qlog marker", () => {
    const line = formatQuestionLog(baseRecord);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).type).toBe("qlog");
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

  it("preserves streamError field when present", () => {
    const errorRecord: QuestionLogRecord = {
      ...baseRecord,
      answered: false,
      answer: "",
      sources: [],
      streamError: true,
    };
    const parsed = JSON.parse(formatQuestionLog(errorRecord));
    expect(parsed.streamError).toBe(true);
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
