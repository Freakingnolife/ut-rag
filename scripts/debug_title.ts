import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
async function main() {
  const idx = await loadIndex(DEFAULT_INDEX_DIR);
  const sw = idx.records.filter(r => r.url === 'https://www.uniontech3d.com/software');
  console.log('/software title:', sw[0]?.title);
  const poly = idx.records.filter(r => r.url === 'https://www.uniontech3d.com/polydevs-3d-printer-software');
  console.log('/polydevs title:', poly[0]?.title);
}
main().catch(console.error);
