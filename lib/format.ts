import type { SourceRef } from "./types";

export function sourcesFromHeader(header: string | null): SourceRef[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header));
    return Array.isArray(parsed) ? (parsed as SourceRef[]) : [];
  } catch {
    return [];
  }
}
