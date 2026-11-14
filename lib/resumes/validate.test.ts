import { describe, expect, it } from "vitest";
import { validateResume } from "./validate";

const enc = (s: string) => new TextEncoder().encode(s);

describe("validateResume", () => {
  it("accepts a real-looking PDF", () => {
    expect(validateResume("cv.PDF", enc("%PDF-1.7\n...")).ok).toBe(true);
  });
  it("accepts a docx-shaped zip", () => {
    const b = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc("....word/document.xml....")]);
    expect(validateResume("cv.docx", b)).toEqual({ ok: true, kind: "docx" });
  });
  it("rejects other extensions", () => {
    for (const n of ["cv.doc", "cv.txt", "cv.exe", "cv", "cv.pdf.exe"]) {
      expect(validateResume(n, enc("%PDF-1.7")).ok).toBe(false);
    }
  });
  it("rejects renamed files (wrong bytes)", () => {
    expect(validateResume("evil.pdf", enc("MZ\x90\x00 executable")).ok).toBe(false);
    expect(validateResume("evil.docx", enc("%PDF-1.7")).ok).toBe(false);
    expect(validateResume("plain.docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])).ok).toBe(false);
  });
  it("rejects empty and oversized files", () => {
    expect(validateResume("a.pdf", new Uint8Array()).ok).toBe(false);
    expect(validateResume("a.pdf", new Uint8Array(10 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});
