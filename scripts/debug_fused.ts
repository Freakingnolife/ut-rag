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
  };

  const queries = [
    "What are the main SLA printer models available from UnionTech?",
    "What software does UnionTech provide for 3D printing workflow?",
    "Where is UnionTech headquartered?",
  ];

  for (const q of queries) {
    const out = await retrieve(q, [], deps);
    console.log(`\n=== "${q}" ===`);
    console.log(`answerable=${out.answerable}`);
    out.chunks.forEach((c, i) => {
      console.log(`  ${i+1}. cos=${c.cosine.toFixed(3)} kw=${c.keyword.toFixed(3)} ${c.url.replace('https://www.uniontech3d.com', '')}`);
    });
  }
}
main().catch(console.error);
