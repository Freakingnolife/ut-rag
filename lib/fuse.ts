import type { Chunk, DocType, RetrievedChunk } from "./types";
import { hasExactModelMatch } from "./keyword";
import type { SearchHit as Hit } from "./vector";

const DOC_AUTHORITY: Record<DocType, number> = {
  product: 1.0, material: 1.0, software: 0.95, solution: 0.9,
  case: 0.9, company: 0.85, blog: 0.7, news: 0.65,
};

export const COSINE_FLOOR = 0.28;

export function rrf(rankings: number[][], k = 60): Map<number, number> {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((idx, rank) => {
      scores.set(idx, (scores.get(idx) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}

export function authorityWeight(docType: DocType, lastmod: string | null, nowIso: string): number {
  let w = DOC_AUTHORITY[docType] ?? 0.7;
  if (lastmod) {
    const ageMs = Date.parse(nowIso) - Date.parse(lastmod);
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);
    if (ageMonths <= 18) w += 0.1;
    else if (ageMonths >= 60) w -= 0.1;
  }
  return w;
}

export interface FuseArgs {
  records: Chunk[];
  semantic: Hit[];
  keyword: number[];
  nowIso: string;
  topK: number;
}

export function fuseAndRank(args: FuseArgs): RetrievedChunk[] {
  const { records, semantic, keyword, nowIso, topK } = args;

  const semByIdx = new Map(semantic.map((h) => [h.idx, h.score]));
  const semRanking = [...semantic].sort((a, b) => b.score - a.score).map((h) => h.idx);
  const kwRanking = keyword
    .map((s, idx) => ({ idx, s }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.idx);

  const fused = rrf([semRanking, kwRanking]);

  const scored: RetrievedChunk[] = records.map((r, idx) => {
    const base = fused.get(idx) ?? 0;
    const auth = authorityWeight(r.docType, r.lastmod, nowIso);
    return {
      ...r,
      cosine: semByIdx.get(idx) ?? 0,
      keyword: keyword[idx] ?? 0,
      score: base * auth,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function shouldAnswer(top: RetrievedChunk[], query: string): boolean {
  if (top.length === 0) return false;
  const best = top[0];
  if (best.cosine >= COSINE_FLOOR) return true;
  return top.some((c) => hasExactModelMatch(c, query));
}
