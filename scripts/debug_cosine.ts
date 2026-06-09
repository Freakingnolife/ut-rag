import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  
  const pairs = [
    { q: 'What DLP and LCD printer models does UnionTech offer', target: 'dlp-and-lcd-materials' },
    { q: 'Does UnionTech have dental 3D printing solutions', target: 'dental-3d-printing' },
    { q: 'What material partners does UnionTech work with', target: 'somos-momentum' },
    { q: 'Does UnionTech offer metal 3D printers', target: 'uniontech-showcases-industrial-am' },
  ];
  
  for (const { q, target } of pairs) {
    const qVec = (await embed([q], 'query', cfg))[0];
    const semantic = cosineSearch(idx.matrix, idx.dim, qVec, idx.records.length);
    
    const targetChunk = idx.records.find(r => r.url.includes(target));
    if (!targetChunk) { console.log('NOT FOUND:', target); continue; }
    const targetIdx = idx.records.indexOf(targetChunk);
    const hit = semantic.find(h => h.idx === targetIdx);
    const rank = semantic.findIndex(h => h.idx === targetIdx);
    
    console.log('\nQ:', q);
    console.log('Target:', target, '| rank:', rank, '| cosine:', hit?.score?.toFixed(4));
    
    // What IS ranking top-3?
    const top3 = semantic.slice(0, 3);
    top3.forEach((h, i) => console.log('  top' + i, h.score.toFixed(4), idx.records[h.idx].url.replace('https://www.uniontech3d.com/', '')));
  }
}
main().catch(console.error);
