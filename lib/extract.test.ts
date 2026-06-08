import { expect, test } from "vitest";
import { extractMainContent, extractSpecTables, classifyDocType } from "./extract";

const html = `<html><head><title>RSPro 2100</title></head>
<body>
  <nav>MENU</nav>
  <header>HEAD</header>
  <main>
    <h1>RSPro 2100</h1>
    <p>Large-format SLA printer.</p>
    <table>
      <caption>Specifications</caption>
      <tr><th>Build Volume</th><td>600 x 600 x 400 mm</td></tr>
      <tr><th>Laser</th><td>355 nm</td></tr>
    </table>
  </main>
  <footer>FOOT</footer>
  <script>var x=1;</script>
</body></html>`;

test("extractMainContent drops nav/header/footer/script", () => {
  const text = extractMainContent(html);
  expect(text).toContain("Large-format SLA printer.");
  expect(text).not.toContain("MENU");
  expect(text).not.toContain("FOOT");
  expect(text).not.toContain("var x");
});

test("extractSpecTables serializes rows as 'header: value'", () => {
  const tables = extractSpecTables(html);
  expect(tables).toHaveLength(1);
  expect(tables[0].caption).toBe("Specifications");
  expect(tables[0].rows).toEqual([
    "Build Volume: 600 x 600 x 400 mm",
    "Laser: 355 nm",
  ]);
});

test("classifyDocType maps URL paths to doc types", () => {
  expect(classifyDocType("https://x.com/products/rspro-2100.html")).toBe("product");
  expect(classifyDocType("https://x.com/case/dental.html")).toBe("case");
  expect(classifyDocType("https://x.com/company-news/launch.html")).toBe("news");
  expect(classifyDocType("https://x.com/blog/tips.html")).toBe("blog");
  expect(classifyDocType("https://x.com/stereolithography-resin")).toBe("material");
  expect(classifyDocType("https://x.com/about")).toBe("company");
  expect(classifyDocType("https://x.com/3d-printing-in-automotive-industry.html")).toBe("solution");
});
