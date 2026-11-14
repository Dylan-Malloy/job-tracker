export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export const MIME: Record<"pdf" | "docx", string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export type ResumeCheck = { ok: true; kind: "pdf" | "docx" } | { ok: false; error: string };

/**
 * Server-side file check. Trusts neither the file name nor the browser-reported MIME type:
 * the extension must be .pdf/.docx AND the bytes must really be a PDF / a DOCX (OOXML zip).
 */
export function validateResume(filename: string, bytes: Uint8Array): ResumeCheck {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext !== "pdf" && ext !== "docx") {
    return { ok: false, error: "Only .pdf and .docx resumes are accepted." };
  }
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > MAX_RESUME_BYTES) return { ok: false, error: "Resumes must be 10 MB or smaller." };

  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (ext === "pdf") {
    if (!head.includes("%PDF-")) {
      return { ok: false, error: "This file has a .pdf name but isn't a real PDF." };
    }
    return { ok: true, kind: "pdf" };
  }
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const body = Buffer.from(bytes).toString("latin1");
  if (!isZip || !body.includes("word/document.xml")) {
    return { ok: false, error: "This file has a .docx name but isn't a real Word document." };
  }
  return { ok: true, kind: "docx" };
}
