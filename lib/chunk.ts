import type { Chunk, RawDoc } from "./types";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function splitIntoChunks(text: string, maxTokens = 800, overlapTokens = 100): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur: string[] = [];
  let curTokens = 0;

  for (const p of paras) {
    const t = estimateTokens(p);
    if (curTokens + t > maxTokens && cur.length) {
      chunks.push(cur.join("\n\n"));
      const overlap: string[] = [];
      let ot = 0;
      for (let i = cur.length - 1; i >= 0 && ot < overlapTokens; i--) {
        overlap.unshift(cur[i]);
        ot += estimateTokens(cur[i]);
      }
      cur = [...overlap];
      curTokens = ot;
    }
    cur.push(p);
    curTokens += t;
  }
  if (cur.length) chunks.push(cur.join("\n\n"));
  return chunks;
}

export function buildChunks(doc: RawDoc): Chunk[] {
  const out: Chunk[] = [];

  for (const table of doc.specTables) {
    // Prefix with page title so the embedding captures which product these specs belong to
    const prefix = doc.title ? `${doc.title} — ${table.caption}` : table.caption;
    out.push({
      chunkId: "",
      url: doc.url,
      title: doc.title,
      docType: doc.docType,
      sourceType: "html-table",
      headingPath: [table.caption],
      lastmod: doc.lastmod,
      text: `${prefix}\n${table.rows.join("\n")}`,
    });
  }

  for (const piece of splitIntoChunks(doc.mainText)) {
    out.push({
      chunkId: "",
      url: doc.url,
      title: doc.title,
      docType: doc.docType,
      sourceType: doc.sourceType,
      headingPath: [],
      lastmod: doc.lastmod,
      text: piece,
    });
  }
  return out;
}
