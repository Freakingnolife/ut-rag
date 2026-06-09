import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { keywordScores, buildIdf } from '../lib/keyword';
import { rrf, authorityWeight } from '../lib/fuse';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const idf = buildIdf(idx.records);
  const query = 'build volume RSPro 2100';
  const qVec = (await embed([query], 'query', cfg))[0];
  const topN = 40;
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec, topN);
  const keyword = keywordScores(idx.records, query, idf);
  
  const semRanking = [...semantic].sort((a, b) => b.score - a.score).map(h => h.idx);
  const kwRanking = keyword.map((s, idx) => ({idx, s})).filter(x => x.s > 0).sort((a,b) => b.s - a.s).map(x => x.idx);
  const fused = rrf([semRanking, kwRanking]);
  
  const r2100 = idx.records.find(r => r.url.includes('rspro-2100-large-sla'));
  const ri2100 = idx.records.indexOf(r2100!);
  
  console.log('RSPro 2100 product page:');
  console.log('  sem rank in top40:', semRanking.indexOf(ri2100), '(not found if not in top40)');
  console.log('  kw rank:', kwRanking.indexOf(ri2100));
  console.log('  fused score:', fused.get(ri2100));
  console.log('  kw score:', keyword[ri2100].toFixed(4));
  
  // Compute final scores for top results
  const scored = [...fused.entries()].map(([idx, base]) => {
    const r = idx.records[idx];
    const auth = authorityWeight(r.docType, r.lastmod, new Date().toISOString());
    return { idx, score: base * auth, base, docType: r.docType, url: r.url };
  }).sort((a, b) => b.score - a.score);
  
  console.log('\nTop 10 fused+auth scores:');
  scored.slice(0, 10).forEach((s, i) => {
    const kw = keyword[s.idx].toFixed(3);
    const cos = (semantic.find(h => h.idx === s.idx)?.score ?? 0).toFixed(3);
    console.log(i, s.score.toFixed(5), `[base:${s.base.toFixed(5)} auth:${authorityWeight(s.docType, null, new Date().toISOString()).toFixed(2)} cos:${cos} kw:${kw}]`, s.url.replace('https://www.uniontech3d.com/', ''));
  });
}
main().catch(console.error);
