import { loadIndex } from '../lib/index-store';
import { loadConfig } from '../lib/config';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { keywordScores } from '../lib/keyword';

async function debugQuery(idx: Awaited<ReturnType<typeof loadIndex>>, cfg: ReturnType<typeof loadConfig>, q: string, targetUrls: string[]) {
  console.log(`\n=== "${q}" ===`);
  const qVec = await embed([q], 'query', cfg);
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec[0], idx.records.length);
  const keyword = keywordScores(idx.records, q);
  
  for (const url of targetUrls) {
    const hits = semantic.filter(s => idx.records[s.idx].url === url);
    if (hits.length === 0) { console.log(`  MISSING: ${url}`); continue; }
    for (const h of hits) {
      console.log(`  rank=${h.rank + 1} cos=${h.score.toFixed(3)} kw=${keyword[h.idx].toFixed(3)} ${url.replace('https://www.uniontech3d.com', '')}`);
    }
  }
  
  console.log('  Top 5 semantic:');
  semantic.slice(0, 5).forEach((s, i) => {
    const r = idx.records[s.idx];
    console.log(`    ${i+1}. cos=${s.score.toFixed(3)} kw=${keyword[s.idx].toFixed(3)} ${r.url.replace('https://www.uniontech3d.com', '')}`);
  });
}

async function main() {
  const cfg = loadConfig();
  const idx = await loadIndex('./data');

  await debugQuery(idx, cfg, "What software does UnionTech provide for 3D printing workflow?", [
    "https://www.uniontech3d.com/software",
    "https://www.uniontech3d.com/polydevs-3d-printer-software",
    "https://www.uniontech3d.com/unionfab-one-3d-printer-software",
  ]);

  await debugQuery(idx, cfg, "Where is UnionTech headquartered?", [
    "https://www.uniontech3d.com/about",
    "https://www.uniontech3d.com/contact",
  ]);

  await debugQuery(idx, cfg, "What are the main SLA printer models available from UnionTech?", [
    "https://www.uniontech3d.com/",
    "https://www.uniontech3d.com/products/rspro-2100-large-sla-printer.html",
    "https://www.uniontech3d.com/fast-and-precise-how-uniontechs-lite-series-redefines-industrial-3d-printing.html",
  ]);
}

main().catch(console.error);
