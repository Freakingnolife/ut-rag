import * as cheerio from "cheerio";
import type { DocType, SpecTable } from "./types";

const STRIP = [
  // Semantic tags
  "nav", "header", "footer", "script", "style", "noscript",
  // Cookie banners
  ".cookie", ".cookie-banner", "#cookie",
  // UnionTech site-specific nav/header/footer divs
  ".sep-lx-header-mb", ".sep-menu-box", ".sep-header", ".header_down",
  ".sep-footer", ".footer-top", ".mp_bottom", ".mp_bottom_up_container",
  ".bottom-toggle", ".toggle", ".sep-search-box",
  // uniontech3d.cn (Chinese CMS) — nav is "daohang" (导航), no English class names
  ".daohang", "#footer", ".footer-nav", ".sidebar-menu__list",
  // Contact form (country dropdown bloat)
  ".contact-bg", "form", "select",
  // Generic nav/menu patterns
  "[class*='menu']", "[class*='nav-']", "[class*='-nav']",
  "[id*='menu']", "[id*='nav']",
];

// Content container selectors tried in priority order (site-specific first)
const CONTENT_SELECTORS = [
  // UnionTech article/blog/product detail content
  ".richtext",
  ".sep-primary",
  // Generic semantic content
  "article",
  "main",
  ".post-content",
  ".entry-content",
  ".page-content",
  ".content-wrap",
];

export function extractMainContent(html: string): string {
  const $ = cheerio.load(html);
  for (const sel of STRIP) $(sel).remove();

  // Try specific content containers first (article/product pages)
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 200) {
      return el.text().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    }
  }

  // For pages without a clear content container (homepage, category pages):
  // collect all sep-section blocks which hold the real page content
  const sections = $(".sep-section-normal, .sep-section1, .sep-section5, .sep-body");
  if (sections.length > 0) {
    return sections.map((_, el) => $(el).text().trim()).get().join("\n\n")
      .replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  // Last resort: full body
  return $("body").text().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function extractSpecTables(html: string): SpecTable[] {
  const $ = cheerio.load(html);
  const tables: SpecTable[] = [];
  $("table").each((_, table) => {
    const caption = $(table).find("caption").first().text().trim() || "Specifications";
    const rows: string[] = [];
    $(table).find("tr").each((_, tr) => {
      const cells = $(tr).find("th,td");
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim();
        const val = $(cells.slice(1).toArray()).map((_, c) => $(c).text().trim()).get().join(" ");
        if (key && val) rows.push(`${key}: ${val}`);
      }
    });
    if (rows.length) tables.push({ caption, rows });
  });
  return tables;
}

export function classifyDocType(url: string): DocType {
  let p: string;
  try {
    p = new URL(url).pathname.toLowerCase();
  } catch {
    return "solution";
  }
  if (p.includes("/products/")) return "product";
  if (p.includes("/case")) return "case";
  if (p.includes("news")) return "news";
  if (p.includes("/blog")) return "blog";
  if (p.includes("material") || p.includes("resin")) return "material";
  if (p.includes("software") || p.includes("/ut-one") || p.includes("polydevs")) return "software";
  if (p === "/about" || p.includes("/company") || p.includes("/contact")) return "company";
  return "solution";
}
