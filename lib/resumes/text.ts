import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export async function extractResumeText(buffer: Buffer, kind: "pdf" | "docx"): Promise<string> {
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}
