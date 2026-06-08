import { loadConfig, type Config } from "./config";
import { loadIndex, DEFAULT_INDEX_DIR } from "./index-store";
import { embed, complete } from "./minimax";
import type { ChatMessage, LoadedIndex } from "./types";

let cfg: Config | null = null;
let index: LoadedIndex | null = null;

export function getConfig(): Config {
  if (!cfg) cfg = loadConfig();
  return cfg;
}

export function getIndex(): LoadedIndex {
  if (!index) index = loadIndex(DEFAULT_INDEX_DIR);
  return index;
}

export function getRetrieveDeps() {
  const c = getConfig();
  return {
    index: getIndex(),
    embedQuery: async (q: string) => (await embed([q], "query", c))[0],
    complete: (messages: ChatMessage[]) => complete(messages, c),
    nowIso: new Date().toISOString(),
  };
}
