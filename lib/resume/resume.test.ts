import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { parseOriginal } from "./parse-original";
import { highlightSets, measureFit, OnePageError, renderOnePagePdf, renderOriginalPdf } from "./render-pdf";
import { renderDocx } from "./render-docx";
import type { ResumeDoc } from "./types";

const bullets = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "bullet" as const, text: `Delivered measurable result number ${i + 1} by building and maintaining reliable backend services for internal teams and external customers alike.` }));
const make = (n: number): ResumeDoc => ({
  name: "Alex Morgan", contact: "alex@example.com | Austin, TX",
  sections: [
    { heading: "Experience", blocks: [{ kind: "title", text: "Software Engineer, Brightside Inc", right: "2019 - 2025" }, ...bullets(n)] },
    { heading: "Skills", blocks: [{ kind: "text", text: "Python, PostgreSQL, AWS — “quotes”, naïve café, 日本語" }] },
  ],
});

describe("one-page guarantee", () => {
  it("fits a normal resume on exactly one PDF page", async () => {
    const { bytes } = await renderOnePagePdf(make(8));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("refuses (never spills to page 2) when too long", async () => {
    const fit = await measureFit(make(60));
    expect(fit.fits).toBe(false);
    expect(fit.overflowLines).toBeGreaterThan(5);
    await expect(renderOnePagePdf(make(60))).rejects.toBeInstanceOf(OnePageError);
    await expect(renderDocx(make(60))).rejects.toBeInstanceOf(OnePageError);
  });
  it("produces a docx for a fitting resume", async () => {
    const buf = await renderDocx(make(8));
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
  it("shrinks font before refusing", async () => {
    const small = await measureFit(make(8));
    const bigger = await measureFit(make(14));
    expect(small.size).toBeGreaterThanOrEqual(bigger.size);
  });
  it("paginates the original and highlights differences", async () => {
    const orig = make(60);
    const bytes = await renderOriginalPdf(orig, highlightSets(orig, make(8)).original);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});

describe("parseOriginal", () => {
  it("finds name, contact, headings, dates and bullets", () => {
    const d = parseOriginal("Alex Morgan\nalex@example.com\nEXPERIENCE\nSoftware Engineer, Brightside Inc (2019 - 2025)\n- Built APIs\nSKILLS\nPython");
    expect(d.name).toBe("Alex Morgan");
    expect(d.contact).toContain("alex@example.com");
    expect(d.sections.map((s) => s.heading)).toEqual(["EXPERIENCE", "SKILLS"]);
    expect(d.sections[0].blocks[0]).toMatchObject({ kind: "title", right: "2019 - 2025" });
    expect(d.sections[0].blocks[1]).toMatchObject({ kind: "bullet", text: "Built APIs" });
  });
});
