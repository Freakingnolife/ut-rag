import { expect, test } from "vitest";
import { loadConfig } from "./config";

const full = {
  MINIMAX_API_KEY: "key",
  MINIMAX_GROUP_ID: "group",
};

test("applies defaults for base URLs and models", () => {
  const cfg = loadConfig(full);
  expect(cfg.MINIMAX_CHAT_BASE_URL).toBe("https://api.minimax.chat/v1");
  expect(cfg.MINIMAX_EMBED_BASE_URL).toBe("https://api.minimax.chat/v1");
  expect(cfg.CHAT_MODEL).toBe("MiniMax-M2");
  expect(cfg.EMBED_MODEL).toBe("embo-01");
});

test("throws when required key is missing", () => {
  expect(() => loadConfig({ MINIMAX_GROUP_ID: "group" })).toThrow();
});
