export interface SearchHit {
  idx: number;
  score: number; // cosine in [-1, 1]
}

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function cosineSearch(
  matrix: Float32Array,
  dim: number,
  query: number[],
  topN: number,
): SearchHit[] {
  const q = normalize(query);
  const rows = matrix.length / dim;
  const hits: SearchHit[] = [];
  for (let r = 0; r < rows; r++) {
    let dot = 0;
    const base = r * dim;
    for (let d = 0; d < dim; d++) dot += matrix[base + d] * q[d];
    hits.push({ idx: r, score: dot });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topN);
}
