"use client";

import { useState } from "react";
import { Citations } from "@/components/Citations";
import { sourcesFromHeader } from "@/lib/format";
import type { ChatMessage, SourceRef } from "@/lib/types";

const EXAMPLES = [
  "Compare RSPro 600 and Lite 600",
  "Which printers suit investment casting?",
  "What is the build volume of the RSPro 2100?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      const sources = sourcesFromHeader(res.headers.get("x-sources"));
      const ct = res.headers.get("content-type") ?? "";

      if (ct.includes("application/json")) {
        const data = (await res.json()) as { answer: string; sources: SourceRef[] };
        update(data.answer, data.sources);
      } else {
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          update(acc, sources);
        }
      }
    } catch {
      update("Sorry, something went wrong. Please try again.", []);
    } finally {
      setBusy(false);
    }
  }

  function update(content: string, sources: SourceRef[]) {
    setTurns((t) => {
      const copy = [...t];
      copy[copy.length - 1] = { role: "assistant", content, sources };
      return copy;
    });
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>UnionTech 3D Assistant</h1>
      <p style={{ opacity: 0.7 }}>Ask about UnionTech printers, materials, software, and applications.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {EXAMPLES.map((q) => (
          <button key={q} onClick={() => send(q)} disabled={busy}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 16, border: "1px solid #ccc", cursor: "pointer" }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "16px 0" }}>
        {turns.map((t, i) => (
          <div key={i} style={{ alignSelf: t.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: t.role === "user" ? "#0b5fff" : "#f1f1f3", color: t.role === "user" ? "white" : "black", whiteSpace: "pre-wrap" }}>
              {t.content || (busy && i === turns.length - 1 ? "…" : "")}
            </div>
            {t.role === "assistant" && <Citations sources={t.sources ?? []} />}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }} disabled={busy} />
        <button type="submit" disabled={busy}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#0b5fff", color: "white", cursor: "pointer" }}>
          Send
        </button>
      </form>
    </main>
  );
}
