import { extractText, getDocumentProxy } from "unpdf";

export type ExtractFn = (data: Uint8Array) => Promise<{ text: string | string[] }>;

// Default extractor uses unpdf; injectable for tests.
const defaultExtract: ExtractFn = async (data) => {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return { text };
};

export async function pdfToText(
  data: Uint8Array,
  extract: ExtractFn = defaultExtract,
): Promise<string> {
  const { text } = await extract(data);
  return Array.isArray(text) ? text.join("\n\n") : text;
}
