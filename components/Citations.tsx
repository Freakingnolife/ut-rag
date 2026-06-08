import type { SourceRef } from "@/lib/types";

export function Citations({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
      <strong>Sources:</strong>
      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
        {sources.map((s) => (
          <li key={s.n}>
            [{s.n}] <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
