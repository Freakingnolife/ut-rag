import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { keywordScores, buildIdf } from '../lib/keyword';
import { fuseAndRank } from '../lib/fuse';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const idf = buildIdf(idx.records);
  
  const queries = [
    { q: 'When was UnionTech founded', target: 'about' },
    { q: 'How can I contact UnionTech', target: 'contact' },
    { q: 'What software does UnionTech provide', target: 'software' },
    { q: 'RSPro 2100 build volume', target: 'rspro-2100-large-sla' },
  ];
  
  for (const { q, target } of queries) {
    const qVec = (await embed([q], 'query', cfg))[0];
    const semantic = cosineSearch(idx.matrix, idx.dim, qVec, idx.records.length);
    const keyword = keywordScores(idx.records, q, idf);
    
    const targetChunk = idx.records.find(r => r.url.includes(target));
    const targetIdx = idx.records.indexOf(targetChunk!);
    const semHit = semantic.find(h => h.idx === targetIdx);
    const semRank = semantic.findIndex(h => h.idx === targetIdx);
    
    console.log('\nQ:', q);
    console.log('Target:', targetChunk?.url?.replace('https://www.uniontech3d.com/', ''));
    console.log('  Cosine rank:', semRank, 'score:', semHit?.score?.toFixed(4));
    console.log('  Keyword score:', keyword[targetIdx]?.toFixed(4));
    
    const top5 = fuseAndRank({ records: idx.records, semantic: semantic.slice(0, 40), keyword, nowIso: new Date().toISOString(), topK: 3 });
    console.log('  Top 3 results:');
    top5.forEach((c, i) => console.log('  ', i, c.score.toFixed(4), c.url.replace('https://www.uniontech3d.com/', '')));
  }
}
main().catch(console.error);
