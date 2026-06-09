import { loadConfig } from '../lib/config';
import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { embed } from '../lib/minimax';
import { retrieve } from '../lib/retrieve';
import type { ChatMessage } from '../lib/types';

async function main() {
  const cfg = loadConfig();
  const idx = loadIndex(DEFAULT_INDEX_DIR);
  const deps = {
    index: idx,
    embedQuery: async (q: string) => (await embed([q], 'query', cfg))[0],
    complete: async () => '',
    nowIso: new Date().toISOString(),
  };
  
  const negatives = [
    'What is the best recipe for sourdough bread?',
    'Who won the 2022 FIFA World Cup?',
    'What is the capital of France?',
    'How do I bake chocolate chip cookies?',
    'Who is the CEO of Apple?',
  ];
  
  for (const q of negatives) {
    const out = await retrieve(q, [] as ChatMessage[], deps);
    const best = out.chunks[0];
    console.log(`Q: ${q}`);
    console.log(`  cosine: ${best?.cosine?.toFixed(4)} | answerable: ${out.answerable} | url: ${best?.url?.replace('https://www.uniontech3d.com/', '')}`);
  }
}
main().catch(console.error);
