export const DOC_TYPES = [
  "product", "material", "software", "solution",
  "case", "blog", "news", "company",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type SourceType = "html-text" | "html-table" | "pdf";

export interface ChunkMeta {
  chunkId: string;
  url: string;
  title: string;
  docType: DocType;
  sourceType: SourceType;
  headingPath: string[];
  lastmod: string | null;
}

export interface Chunk extends ChunkMeta {
  text: string;
}

export interface RetrievedChunk extends Chunk {
  cosine: number;
  keyword: number;
  score: number;
}

export interface SpecTable {
  caption: string;
  rows: string[];
}

export interface RawDoc {
  url: string;
  title: string;
  docType: DocType;
  lastmod: string | null;
  sourceType: "html-text" | "pdf";
  mainText: string;
  specTables: SpecTable[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LoadedIndex {
  dim: number;
  records: Chunk[];
  matrix: Float32Array; // records.length * dim, row-major, L2-normalized
}

export interface SourceRef {
  n: number; // 1-based citation label shown to the model
  url: string;
  title: string;
}
