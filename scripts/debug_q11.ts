import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { loadConfig } from '../lib/config';
import { embed } from '../lib/minimax';
import { retrieve } from '../lib/retrieve';
import type { ChatMessage } from '../lib/types';

async function main() {
  const cfg = loadConfig();
  const index = await loadIndex(DEFAULT_INDEX_DIR);
  const deps = {
    index, 
    embedQuery: async (q: string) => (await embed([q], 'query', cfg))[0],
    complete: (m: ChatMessage[]) => Promise.resolve(""),
    nowIso: new Date().toISOString(),
    topK: 12,
  };
  const out = await retrieve("What software does UnionTech provide for 3D printing workflow?", [], deps);
  console.log('Fused top-12:');
  out.chunks.forEach((c, i) => {
    console.log(`  ${i+1}. cos=${c.cosine.toFixed(3)} kw=${c.keyword.toFixed(3)} ${c.url.replace('https://www.uniontech3d.com', '')}`);
  });
}
main().catch(console.error);
