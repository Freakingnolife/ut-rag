import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { loadConfig } from '../lib/config';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { keywordScores } from '../lib/keyword';
import { fuseAndRank } from '../lib/fuse';

async function main() {
  const cfg = loadConfig();
  const idx = await loadIndex(DEFAULT_INDEX_DIR);
  const q = "Where is UnionTech headquartered?";
  const qVec = (await embed([q], 'query', cfg))[0];
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec, idx.records.length);
  const keyword = keywordScores(idx.records, q);
  const nowIso = new Date().toISOString();
  
  // Find anniversary blog rank
  const annivUrl = 'https://www.uniontech3d.com/uniontech-celebrated-20th-anniversary-by-two-decades-history-creating-intelligence-future.html';
  const annivSemHit = semantic.find(s => idx.records[s.idx].url === annivUrl);
  const annivIdx = idx.records.findIndex(r => r.url === annivUrl);
  const annivKw = annivIdx >= 0 ? keyword[annivIdx] : -1;
  console.log(`Anniversary: sem_rank=${annivSemHit?.rank ?? 'not found'}, cos=${annivSemHit?.score.toFixed(3)}, kw=${annivKw.toFixed(3)}`);
  
  // keyword rank of anniversary
  const kwPairs = keyword.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
  const annivKwRank = kwPairs.findIndex(p => p.i === annivIdx);
  console.log(`Anniversary keyword rank: ${annivKwRank + 1}`);
  
  // Full fused ranking (top 20)
  const fused = fuseAndRank({ records: idx.records, semantic, keyword, nowIso, topK: 20 });
  console.log('\nFused top 20:');
  fused.forEach((c, i) => {
    const anniv = c.url === annivUrl ? ' ← ANNIVERSARY' : '';
    console.log(`  ${i+1}. cos=${c.cosine.toFixed(3)} kw=${c.keyword.toFixed(3)} score=${c.score.toFixed(4)} ${c.url.replace('https://www.uniontech3d.com', '')}${anniv}`);
  });
}
main().catch(console.error);
