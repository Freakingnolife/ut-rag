import { loadIndex, DEFAULT_INDEX_DIR } from '../lib/index-store';
import { loadConfig } from '../lib/config';
import { embed } from '../lib/minimax';
import { retrieve } from '../lib/retrieve';
import type { ChatMessage } from '../lib/types';

const QUERIES = [
  // Answerable (should pass)
  "What 3D printing technologies does UnionTech offer?",
  "What are the main SLA printer models available from UnionTech?",
  "Which UnionTech printers are suited for investment casting?",
  "What resin materials are compatible with UnionTech SLA printers?",
  "Does UnionTech offer metal 3D printers?",
  "What DLP and LCD printer models does UnionTech offer?",
  "How many UnionTech 3D printers are installed worldwide?",
  "What industries does UnionTech serve with its 3D printing solutions?",
  "What software does UnionTech provide for 3D printing workflow?",
  "Does UnionTech offer 3D printing services in addition to selling printers?",
  "When was UnionTech founded?",
  "Where is UnionTech headquartered?",
  "What is UnionTech's market share in China's 3D printing industry?",
  "Does UnionTech have dental 3D printing solutions?",
  "What material partners does UnionTech work with?",
  "How can I contact UnionTech for a product inquiry?",
  // Near-domain negatives
  "What is the best desktop FDM printer for beginners?",
  "How do I calibrate a Formlabs Form 3?",
];

async function main() {
  const cfg = loadConfig();
  const index = await loadIndex(DEFAULT_INDEX_DIR);
  const deps = {
    index, embedQuery: async (q: string) => (await embed([q], 'query', cfg))[0],
    complete: (m: ChatMessage[]) => Promise.resolve(""), nowIso: new Date().toISOString(),
  };
  for (const q of QUERIES) {
    const out = await retrieve(q, [], deps);
    const topCos = out.chunks[0]?.cosine ?? 0;
    const label = q.length > 50 ? q.slice(0, 50) + '...' : q;
    console.log(`${topCos.toFixed(3)} | ${out.answerable ? 'ANS' : 'REJ'} | ${label}`);
  }
}
main().catch(console.error);
