import * as cheerio from "cheerio";
import type { DocType, SpecTable } from "./types";

const STRIP = ["nav", "header", "footer", "script", "style", "noscript",
  ".cookie", ".cookie-banner", "#cookie"];

export function extractMainContent(html: string): string {
  const $ = cheerio.load(html);
  for (const sel of STRIP) $(sel).remove();
  const root = $("main").length ? $("main") : $("body");
  return root.text().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
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
  const p = new URL(url).pathname.toLowerCase();
  if (p.includes("/products/")) return "product";
  if (p.includes("/case")) return "case";
  if (p.includes("news")) return "news";
  if (p.includes("/blog")) return "blog";
  if (p.includes("material") || p.includes("resin")) return "material";
  if (p.includes("software") || p.includes("/ut-one") || p.includes("polydevs")) return "software";
  if (p === "/about" || p.includes("/company") || p.includes("/contact")) return "company";
  return "solution";
}
