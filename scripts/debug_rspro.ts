import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  
  const query = 'build volume RSPro 2100';
  const qVec = (await embed([query], 'query', cfg))[0];
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec, idx.records.length);
  
  // Find product page and articles  
  const targets = ['rspro-2100-large-sla-printer', 'industrial-grade-sla-rspro-2100', 'maximizing-efficiency'];
  for (const t of targets) {
    const rec = idx.records.find(r => r.url.includes(t));
    if (!rec) continue;
    const ri = idx.records.indexOf(rec);
    const hit = semantic.find(h => h.idx === ri);
    const rank = semantic.findIndex(h => h.idx === ri);
    console.log('rank:', rank, 'cos:', hit?.score?.toFixed(4), rec.url.replace('https://www.uniontech3d.com/', ''));
    console.log('  text:', rec.text.slice(0, 150));
  }
  
  console.log('\nTop 10:');
  semantic.slice(0, 10).forEach((h, i) => {
    console.log(i, h.score.toFixed(4), idx.records[h.idx].url.replace('https://www.uniontech3d.com/', ''));
  });
}
main().catch(console.error);
