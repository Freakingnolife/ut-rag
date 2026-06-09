import { loadIndex } from '../lib/index-store';
async function main() {
  const idx = await loadIndex('./data');
  const sw = idx.records.filter(r => r.url.includes('software'));
  console.log('software pages:', [...new Set(sw.map(r=>r.url))].join('\n'));
  const hq = idx.records.filter(r => r.url.includes('/contact') || (r.url.includes('/about') && !r.url.includes('about.')));
  console.log('\ncontact/about:', [...new Set(hq.map(r=>r.url))].join('\n'));
  const prod = idx.records.filter(r => r.url.includes('/products/'));
  console.log('\nproduct page count:', [...new Set(prod.map(r=>r.url))].length);
}
main().catch(console.error);
