import React from "react";
import { parseMarkdown, type Span } from "@/lib/markdown";

const citeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  margin: "0 1px",
  font: "600 11px/1 var(--font-mono)",
  color: "var(--ink-900)",
  background: "var(--signal-cyan)",
  borderRadius: 4,
  transform: "translateY(-1px)",
};

function Spans({ spans, k }: { spans: Span[]; k: string }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.kind === "bold") return <strong key={`${k}-${i}`} style={{ fontWeight: 600, color: "#fff" }}>{s.text}</strong>;
        if (s.kind === "cite") return <span key={`${k}-${i}`} style={citeStyle}>{s.n}</span>;
        return <React.Fragment key={`${k}-${i}`}>{s.text}</React.Fragment>;
      })}
    </>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.type === "heading") {
          return (
            <div key={k} style={{ font: "600 16px/1.3 var(--font-sans)", color: "#fff", margin: i ? "16px 0 2px" : "0 0 2px", letterSpacing: -0.2 }}>
              <Spans spans={b.spans} k={k} />
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={k} style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 5 }}>
              {b.items.map((item, j) => (
                <li key={`${k}-${j}`} style={{ lineHeight: 1.6, paddingLeft: 2 }}>
                  <Spans spans={item} k={`${k}-${j}`} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={k} style={{ margin: i ? "10px 0 0" : 0, lineHeight: 1.7 }}>
            <Spans spans={b.spans} k={k} />
          </p>
        );
      })}
    </>
  );
}
