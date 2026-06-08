import { expect, test } from "vitest";
import { parseSitemap } from "./sitemap";

const urlset = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.com/a</loc><lastmod>2025-01-02</lastmod></url>
  <url><loc>https://x.com/b</loc></url>
</urlset>`;

const index = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://x.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://x.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;

test("parses a urlset into entries", () => {
  const r = parseSitemap(urlset);
  expect(r.isIndex).toBe(false);
  expect(r.entries).toEqual([
    { url: "https://x.com/a", lastmod: "2025-01-02" },
    { url: "https://x.com/b", lastmod: null },
  ]);
});

test("parses a sitemap index into child sitemap URLs", () => {
  const r = parseSitemap(index);
  expect(r.isIndex).toBe(true);
  expect(r.sitemaps).toEqual([
    "https://x.com/sitemap-1.xml",
    "https://x.com/sitemap-2.xml",
  ]);
});
