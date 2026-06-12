import type { ChatMessage, LoadedIndex, RetrievedChunk } from "./types";
import { cosineSearch } from "./vector";
import { keywordScores } from "./keyword";
import { fuseAndRank, shouldAnswer } from "./fuse";
import { rewriteQuery } from "./rewrite";

export interface RetrieveDeps {
  index: LoadedIndex;
  embedQuery: (q: string) => Promise<number[]>;
  complete: (messages: ChatMessage[]) => Promise<string>;
  nowIso: string;
  topN?: number;
  topK?: number;
}

export interface RetrieveResult {
  query: string;
  chunks: RetrievedChunk[];
  answerable: boolean;
}

export async function retrieve(
  question: string,
  history: ChatMessage[],
  deps: RetrieveDeps,
): Promise<RetrieveResult> {
  const topN = deps.topN ?? 40;
  const topK = deps.topK ?? 8;

  const query = await rewriteQuery(history, question, deps.complete);
  const qVec = await deps.embedQuery(query);

  const semantic = cosineSearch(deps.index.matrix, deps.index.dim, qVec, topN);
  const keyword = keywordScores(deps.index.records, query);

  const chunks = fuseAndRank({
    records: deps.index.records,
    semantic,
    keyword,
    nowIso: deps.nowIso,
    topK,
    query,
  });

  return { query, chunks, answerable: shouldAnswer(chunks, query) };
}
