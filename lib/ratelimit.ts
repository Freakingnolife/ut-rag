import type { ChatMessage } from "./types";

interface BucketState {
  tokens: number;
  last: number; // ms
}

export class TokenBucket {
  private state = new Map<string, BucketState>();
  private startMs: number;

  constructor(
    private capacity: number,
    private refillPerSec: number,
    startMs: number,
  ) {
    this.startMs = startMs;
  }

  tryRemove(key: string, nowMs: number): boolean {
    const s = this.state.get(key) ?? { tokens: this.capacity, last: this.startMs };
    const elapsedSec = Math.max(0, (nowMs - s.last) / 1000);
    s.tokens = Math.min(this.capacity, s.tokens + elapsedSec * this.refillPerSec);
    s.last = nowMs;
    let ok = false;
    if (s.tokens >= 1) {
      s.tokens -= 1;
      ok = true;
    }
    this.state.set(key, s);
    return ok;
  }
}

export const MAX_MESSAGE_CHARS = 8000;
export const MAX_HISTORY_TURNS = 30;

export function checkRequestSize(
  message: string,
  history: ChatMessage[],
): { ok: boolean; reason?: string } {
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, reason: "message too long" };
  }
  if (history.length > MAX_HISTORY_TURNS) {
    return { ok: false, reason: "conversation too long" };
  }
  return { ok: true };
}
