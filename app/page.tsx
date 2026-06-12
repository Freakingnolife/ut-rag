"use client";

import { useState, useRef, useEffect } from "react";
import { Markdown } from "@/components/Markdown";
import { parseCitations } from "@/lib/citations";
import { sourcesFromHeader } from "@/lib/format";
import type { ChatMessage, SourceRef } from "@/lib/types";

// Strip completed <think>...</think> blocks; hide in-progress thinking too.
function stripThinking(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  out = out.replace(/<think>[\s\S]*$/, "");
  return out.trimStart();
}

// Only the sources actually cited (e.g. "[2][5]") in an answer; fall back to all.
function citedSources(text: string, sources: SourceRef[]): SourceRef[] {
  const nums = new Set(parseCitations(text));
  const cited = sources.filter((s) => nums.has(s.n));
  return cited.length ? cited : sources;
}

const EXAMPLES = [
  "Compare RSPro 600 and Lite 600",
  "Which printers suit investment casting?",
  "What is the build volume of the RSPro 2100?",
];

const CAPABILITIES = [
  { tag: "SLA", label: "Stereolithography" },
  { tag: "DLP", label: "Digital Light Processing" },
  { tag: "LCD", label: "Liquid-Crystal Display" },
  { tag: "SLM", label: "Selective Laser Melting" },
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const on = () => setMatches(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

function SourceCard({ s }: { s: SourceRef }) {
  return (
    <a href={s.url} target="_blank" rel="noreferrer"
      style={{ display: "block", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--ink-600)", background: "var(--ink-800)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ font: "600 11px/1 var(--font-mono)", color: "var(--ink-900)", background: "var(--signal-cyan)", padding: "3px 6px", borderRadius: 4 }}>{s.n}</span>
        <span style={{ font: "500 10px/1 var(--font-mono)", letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-500)" }}>Source</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, color: "#dfe7ee", fontWeight: 500 }}>{s.title}</div>
    </a>
  );
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const started = turns.length > 0;
  const isMobile = useMediaQuery("(max-width: 720px)");

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }); }, [turns]);

  function update(content: string, sources: SourceRef[]) {
    setTurns((t) => {
      const copy = [...t];
      copy[copy.length - 1] = { role: "assistant", content, sources };
      return copy;
    });
  }

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

      if (!res.ok) {
        const errText = await res.text();
        update(errText || "Sorry, something went wrong. Please try again.", []);
        return;
      }

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
          update(stripThinking(acc), sources);
        }
      }
    } catch {
      update("Sorry, something went wrong. Please try again.", []);
    } finally {
      setBusy(false);
    }
  }

  // Latest assistant answer with sources — desktop panel shows only its cited sources.
  const lastAnswer = [...turns].reverse().find((t) => t.role === "assistant" && (t.sources?.length ?? 0) > 0);
  const lastSources: SourceRef[] = lastAnswer ? citedSources(lastAnswer.content, lastAnswer.sources!) : [];
  const showDockedPanel = started && !isMobile;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--ink-900)", color: "#eef3f7", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* engineering grid + glow wash */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(var(--ink-700) 1px, transparent 1px), linear-gradient(90deg, var(--ink-700) 1px, transparent 1px)", backgroundSize: "64px 64px", opacity: 0.3, pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: -200, left: "38%", transform: "translateX(-50%)", width: 760, height: 380, background: "radial-gradient(ellipse, rgba(43,184,214,0.15), transparent 70%)", pointerEvents: "none" }} />

      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "14px 18px" : "20px 36px", borderBottom: "1px solid var(--ink-700)", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 9, height: 9, flexShrink: 0, background: "var(--signal-cyan)", borderRadius: 2, boxShadow: "0 0 10px var(--signal-cyan)" }} />
          <span style={{ font: "700 15px/1 var(--font-sans)", letterSpacing: 0.3 }}>UnionTech</span>
          {!isMobile && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--ink-600)", margin: "0 4px" }} />
              <span style={{ font: "500 11px/1 var(--font-mono)", letterSpacing: 1.5, color: "var(--steel-500)" }}>3D ASSISTANT</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          {CAPABILITIES.map((c) => (
            <span key={c.tag} title={c.label}
              style={{ font: `600 ${isMobile ? 10 : 11}px/1 var(--font-mono)`, letterSpacing: 1, padding: isMobile ? "4px 6px" : "5px 9px", borderRadius: 4, background: "var(--ink-700)", color: "var(--signal-cyan)", border: "1px solid var(--ink-600)" }}>
              {c.tag}
            </span>
          ))}
        </div>
      </header>

      {/* MAIN: conversation column + (desktop only) docked sources panel */}
      <div style={{ position: "relative", flex: 1, display: "grid", gridTemplateColumns: showDockedPanel ? "minmax(0,1fr) 320px" : "minmax(0,1fr)", minHeight: 0, zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div ref={scroll} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {!started && (
              <div style={{ width: "100%", maxWidth: 720, padding: isMobile ? "7vh 22px 0" : "11vh 24px 0", textAlign: "center" }}>
                <div style={{ font: `500 ${isMobile ? 11 : 12}px/1 var(--font-mono)`, letterSpacing: 3, textTransform: "uppercase", color: "var(--signal-cyan)", marginBottom: isMobile ? 16 : 22 }}>
                  Born for innovation
                </div>
                <h1 style={{ font: "700 clamp(28px, 8vw, 56px)/1.08 var(--font-sans)", letterSpacing: -1 }}>
                  Ask anything about{isMobile ? " " : <br />}UnionTech 3D printing.
                </h1>
                <p style={{ marginTop: isMobile ? 14 : 20, fontSize: isMobile ? 15 : 16.5, lineHeight: 1.6, color: "var(--steel-300)", maxWidth: 520, margin: `${isMobile ? 14 : 20}px auto 0` }}>
                  An industrial additive-manufacturing assistant grounded in the official UnionTech knowledge base — every answer cited to source.
                </p>
              </div>
            )}

            {started && (
              <div style={{ width: "100%", maxWidth: 760, padding: isMobile ? "20px 16px 16px" : "36px 28px 24px", display: "grid", gap: isMobile ? 14 : 18 }}>
                {turns.map((t, i) => {
                  if (t.role === "user") {
                    return (
                      <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--accent)", color: "#fff", padding: "12px 17px", borderRadius: "13px 13px 3px 13px", fontSize: 15.5, lineHeight: 1.55 }}>
                        {t.content}
                      </div>
                    );
                  }
                  const cited = t.content && (t.sources?.length ?? 0) > 0 ? citedSources(t.content, t.sources!) : [];
                  return (
                    <div key={i}>
                      <div style={{ background: "var(--ink-800)", border: "1px solid var(--ink-600)", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: "1px solid var(--ink-700)", background: "var(--ink-700)" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--signal-cyan)", boxShadow: "0 0 8px var(--signal-cyan)" }} />
                          <span style={{ font: "600 11px/1 var(--font-mono)", letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-300)" }}>Assistant</span>
                          {cited.length > 0 && (
                            <span style={{ marginLeft: "auto", font: "500 11px/1 var(--font-mono)", color: "var(--steel-500)" }}>{cited.length} {cited.length === 1 ? "source" : "sources"}</span>
                          )}
                        </div>
                        <div style={{ padding: "16px 18px", fontSize: 15.5, color: "#dfe7ee" }}>
                          {t.content ? <Markdown text={t.content} /> : (busy && i === turns.length - 1 ? "…" : "")}
                        </div>
                      </div>
                      {isMobile && cited.length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ font: "600 11px/1 var(--font-mono)", letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-500)", cursor: "pointer", padding: "6px 2px" }}>
                            Sources &amp; Context ({cited.length})
                          </summary>
                          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                            {cited.map((s) => <SourceCard key={s.n} s={s} />)}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ padding: started ? (isMobile ? "12px 16px 18px" : "16px 28px 26px") : (isMobile ? "0 18px 8vh" : "0 24px 13vh"), display: "flex", justifyContent: "center" }}>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ width: "100%", maxWidth: 720 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--ink-700)", border: "1px solid var(--ink-600)", borderRadius: 14, padding: 8, boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={isMobile ? "Ask a question…" : "Ask about specs, materials, applications…"} disabled={busy}
                  style={{ flex: 1, minWidth: 0, padding: "12px 16px", border: "none", outline: "none", background: "transparent", color: "#fff", fontSize: 16, fontFamily: "var(--font-sans)" }} />
                <button type="submit" disabled={busy}
                  style={{ flexShrink: 0, padding: isMobile ? "12px 16px" : "12px 22px", borderRadius: 9, border: "none", background: busy ? "var(--steel-500)" : "var(--signal-cyan)", color: "var(--ink-900)", font: "600 14px/1 var(--font-sans)", cursor: busy ? "default" : "pointer" }}>
                  {busy ? "…" : "Ask"}
                </button>
              </div>
              {!started && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
                  {EXAMPLES.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} disabled={busy}
                      style={{ fontSize: 13, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--ink-600)", background: "transparent", color: "var(--steel-300)", cursor: "pointer" }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>

        {showDockedPanel && (
          <aside style={{ borderLeft: "1px solid var(--ink-700)", background: "rgba(15,30,46,0.6)", backdropFilter: "blur(4px)", padding: "24px 20px", overflowY: "auto" }}>
            <div style={{ font: "600 11px/1 var(--font-mono)", letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-500)", marginBottom: 16 }}>
              Sources &amp; Context
            </div>
            {lastSources.length === 0 ? (
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--steel-500)", padding: "16px", border: "1px dashed var(--ink-600)", borderRadius: 8 }}>
                Cited sources from the latest answer appear here, linked back to uniontech3d.com.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {lastSources.map((s) => <SourceCard key={s.n} s={s} />)}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
