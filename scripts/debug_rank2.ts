import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const query = 'RSPro 2100 build volume specifications';
  const qVec = (await embed([query], 'query', cfg))[0];
  // Get ALL similarities and find where product page ranks
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec, idx.records.length);
  const rsproProdIdx = idx.records.findIndex(r => r.url.includes('rspro-2100-large-sla-printer'));
  const rspro2100ArticleIdx = idx.records.findIndex(r => r.url.includes('industrial-grade-sla-rspro-2100'));
  const maximizingIdx = idx.records.findIndex(r => r.url.includes('maximizing-efficiency'));
  
  console.log('Total records:', idx.records.length);
  console.log('rspro-2100-large-sla-printer idx:', rsproProdIdx);
  console.log('industrial-grade-sla-rspro-2100 idx:', rspro2100ArticleIdx);
  console.log('maximizing-efficiency idx:', maximizingIdx);
  
  // Find rank of each in semantic results
  for (const targetIdx of [rsproProdIdx, rspro2100ArticleIdx, maximizingIdx]) {
    if (targetIdx === -1) continue;
    const rank = semantic.findIndex(h => h.idx === targetIdx);
    const score = semantic.find(h => h.idx === targetIdx)?.score;
    console.log('\nURL:', idx.records[targetIdx].url.replace('https://www.uniontech3d.com/', ''));
    console.log('  Cosine rank:', rank, 'score:', score?.toFixed(4));
    console.log('  Text preview:', idx.records[targetIdx].text.slice(0, 150));
  }
  
  // Show top 10 semantic hits
  console.log('\nTop 10 semantic hits:');
  semantic.slice(0, 10).forEach((h, i) => {
    console.log(i, h.score.toFixed(4), idx.records[h.idx].url.replace('https://www.uniontech3d.com/', ''));
  });
}
main().catch(console.error);
