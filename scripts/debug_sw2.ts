import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { loadConfig } from '../lib/config';
import { embed } from '../lib/minimax';
import { cosineSearch } from '../lib/vector';
import { tokenize, tokenizeQuery, keywordScores } from '../lib/keyword';

async function main() {
  const cfg = loadConfig();
  const idx = await loadIndex(DEFAULT_INDEX_DIR);
  const query = "What software does UnionTech provide for 3D printing workflow?";
  const qTokens = new Set(tokenizeQuery(query));
  console.log('Effective tokens:', [...qTokens].join(', '));
  
  // Show keyword scores for the expected URLs
  const expectedUrls = [
    'https://www.uniontech3d.com/software',
    'https://www.uniontech3d.com/polydevs-3d-printer-software',
    'https://www.uniontech3d.com/unionfab-one-3d-printer-software',
  ];
  const kw = keywordScores(idx.records, query);
  
  for (const url of expectedUrls) {
    const hits = idx.records.map((r, i) => ({r, i})).filter(({r}) => r.url === url);
    for (const {r, i} of hits) {
      const matched = [...qTokens].filter(t => new Set(tokenize(r.text)).has(t));
      console.log(`${url.replace('https://www.uniontech3d.com', '')}: kw=${kw[i].toFixed(3)} matched:[${matched.join(',')}]`);
      console.log(`  text: ${r.text.slice(0, 150)}`);
    }
  }
  
  // Show top-10 by keyword for this query
  const kwSorted = kw.map((s,i) => ({s,i})).sort((a,b) => b.s-a.s).slice(0,10);
  console.log('\nTop 10 keyword:');
  kwSorted.forEach(({s, i}, rank) => {
    console.log(`  ${rank+1}. kw=${s.toFixed(3)} ${idx.records[i].url.replace('https://www.uniontech3d.com', '')}`);
  });
  
  // Get semantic ranks too
  const qVec = (await embed([query], 'query', cfg))[0];
  const semantic = cosineSearch(idx.matrix, idx.dim, qVec, 40);
  console.log('\nSemantic top 10:');
  semantic.slice(0, 10).forEach((s, i) => {
    const kws = kw[s.idx];
    console.log(`  ${i+1}. cos=${s.score.toFixed(3)} kw=${kws.toFixed(3)} ${idx.records[s.idx].url.replace('https://www.uniontech3d.com', '')}`);
  });
}
main().catch(console.error);
