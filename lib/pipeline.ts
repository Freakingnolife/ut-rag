import * as cheerio from "cheerio";
import type { Chunk, RawDoc } from "./types";
import { extractMainContent, extractSpecTables, classifyDocType } from "./extract";

export function assignChunkIds(chunks: Chunk[]): Chunk[] {
  return chunks.map((c, i) => ({ ...c, chunkId: `c${i}` }));
}

export function htmlToRawDoc(url: string, html: string, lastmod: string | null): RawDoc {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;
  return {
    url,
    title,
    docType: classifyDocType(url),
    lastmod,
    sourceType: "html-text",
    mainText: extractMainContent(html),
    specTables: extractSpecTables(html),
  };
}
