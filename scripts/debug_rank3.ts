import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { keywordScores } from '../lib/keyword';

function main() {
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const query = 'RSPro 2100 build volume specifications';
  const keyword = keywordScores(idx.records, query);
  
  // Find product page positions
  const targets = [
    'rspro-2100-large-sla-printer',
    'industrial-grade-sla-rspro-2100',
    'maximizing-efficiency-in-industrial-production-with-the-rspro-2100',
    'elevating-precision-in-large-scale-manufacturing-with-rspro-2100',
  ];
  
  for (const t of targets) {
    const i = idx.records.findIndex(r => r.url.includes(t));
    if (i >= 0) {
      console.log('kw=' + keyword[i].toFixed(3), idx.records[i].url.replace('https://www.uniontech3d.com/', ''));
      console.log('  text preview:', idx.records[i].text.slice(0, 100));
    }
  }
  
  // Top keyword matches
  console.log('\nTop keyword matches for query:');
  const kwWithIdx = keyword.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  kwWithIdx.slice(0, 10).forEach(({ s, i }) => {
    console.log('kw=' + s.toFixed(3), idx.records[i].url.replace('https://www.uniontech3d.com/', ''));
  });
}
main();
