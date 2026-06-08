import { XMLParser } from "fast-xml-parser";

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

export interface ParsedSitemap {
  isIndex: boolean;
  entries: SitemapEntry[];
  sitemaps: string[];
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function parseSitemap(xml: string): ParsedSitemap {
  const parser = new XMLParser({ ignoreAttributes: true });
  const doc = parser.parse(xml) as any;

  if (doc.sitemapindex) {
    const sitemaps = toArray(doc.sitemapindex.sitemap).map((s: any) => String(s.loc));
    return { isIndex: true, entries: [], sitemaps };
  }

  const entries = toArray(doc.urlset?.url).map((u: any) => ({
    url: String(u.loc),
    lastmod: u.lastmod != null ? String(u.lastmod) : null,
  }));
  return { isIndex: false, entries, sitemaps: [] };
}
