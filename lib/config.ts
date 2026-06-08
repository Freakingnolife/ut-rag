import { z } from "zod";

const EnvSchema = z.object({
  MINIMAX_API_KEY: z.string().min(1),
  MINIMAX_GROUP_ID: z.string().min(1).optional().default(""),
  MINIMAX_CHAT_BASE_URL: z.string().url().default("https://api.minimax.chat/v1"),
  MINIMAX_EMBED_BASE_URL: z.string().url().default("https://api.minimax.chat/v1"),
  CHAT_MODEL: z.string().min(1).default("MiniMax-M2"),
  EMBED_MODEL: z.string().min(1).default("embo-01"),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return EnvSchema.parse(env);
}
