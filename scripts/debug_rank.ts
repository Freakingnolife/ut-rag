import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { keywordScores } from '../lib/keyword';
import { fuseAndRank } from '../lib/fuse';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const queries = [
    'RSPro 2100 build volume specifications',
    'UnionTech founded year headquarters',
    'UnionTech software 3D printing workflow',
  ];
  for (const query of queries) {
    console.log('\n=== Query:', query);
    const qVec = (await embed([query], 'query', cfg))[0];
    const semantic = cosineSearch(idx.matrix, idx.dim, qVec, 20);
    const keyword = keywordScores(idx.records, query);
    const chunks = fuseAndRank({ records: idx.records, semantic, keyword, nowIso: new Date().toISOString(), topK: 5 });
    chunks.forEach((c, i) => {
      console.log(i, c.score.toFixed(4), 'cos=' + c.cosine.toFixed(3), 'kw=' + c.keyword.toFixed(2), c.url.replace('https://www.uniontech3d.com/', ''));
    });
  }
}
main().catch(console.error);
