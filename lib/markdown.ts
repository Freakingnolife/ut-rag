// Minimal markdown parser for the subset the chat model emits: ATX headings (#, ##),
// blank-line paragraphs, "- " bullet lists, **bold**, and inline [n] citations.
// Pure: text in, block AST out. Rendering lives in components/Markdown.tsx.

export type Span =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "cite"; n: number };

export type Block =
  | { type: "p"; spans: Span[] }
  | { type: "heading"; level: number; spans: Span[] }
  | { type: "ul"; items: Span[][] };

function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|\[\d+\])/g)) {
    if (!part) continue;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    const cite = part.match(/^\[(\d+)\]$/);
    if (bold) spans.push({ kind: "bold", text: bold[1] });
    else if (cite) spans.push({ kind: "cite", n: Number(cite[1]) });
    else spans.push({ kind: "text", text: part });
  }
  return spans;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: Span[][] = [];

  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ type: "p", spans: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "ul", items: list });
    list = [];
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, spans: parseInline(heading[2]) });
    } else if (bullet) {
      flushPara();
      list.push(parseInline(bullet[1]));
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
