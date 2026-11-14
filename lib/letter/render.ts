import { AlignmentType, BorderStyle, Document, LineRuleType, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument } from "pdf-lib";
import { loadFonts, PAGE, sanitize, SAFETY, wrap, type Fonts, type Op } from "../resume/layout";
import { draw } from "../resume/render-pdf";
import type { LetterDoc } from "./types";

const M = 62; // letters get slightly wider margins than resumes
const MAX = 11;
const MIN = 9.5;

type LetterLayout = { ops: Op[]; endY: number; limitY: number; lineHeight: number };

function layoutLetter(l: LetterDoc, fonts: Fonts, size: number): LetterLayout {
  const { w: W, h: H } = PAGE;
  const cw = W - 2 * M;
  const lh = size * 1.38;
  const ops: Op[] = [];
  let y = M;
  const S = (t: string, f = fonts.regular) => sanitize(t, f);
  const line = (text: string, font: keyof Fonts, sz: number, color: [number, number, number]) => {
    ops.push({ t: "text", page: 0, x: M, y: y + sz, text, font, size: sz, color });
  };
  const block = (text: string, font: keyof Fonts = "regular", sz = size, color: [number, number, number] = [0.1, 0.1, 0.14]) => {
    for (const ln of wrap(S(text, fonts[font]), fonts[font], sz, cw)) { line(ln, font, sz, color); y += lh * (sz / size); }
  };

  const nameSize = size * 1.6;
  line(S(l.name, fonts.bold), "bold", nameSize, [0.07, 0.07, 0.1]);
  y += nameSize * 1.25;
  if (l.contact) block(l.contact, "regular", size * 0.95, [0.3, 0.3, 0.35]);
  ops.push({ t: "rule", page: 0, x1: M, x2: W - M, y: y + 2 });
  y += size * 1.7;
  block(l.date, "regular", size, [0.3, 0.3, 0.35]);
  y += size * 0.9;
  block("Hiring Team");
  block(l.company);
  y += size * 0.9;
  block(l.greeting);
  for (const p of l.paragraphs) { y += size * 0.75; block(p); }
  y += size * 0.9;
  block(l.closing);
  y += size * 1.1;
  block(l.signature, "bold");

  return { ops, endY: y, limitY: M + (H - 2 * M) * SAFETY, lineHeight: lh };
}

export type LetterFit = { fits: boolean; size: number; overflowLines: number };

export async function measureLetterFit(l: LetterDoc): Promise<LetterFit> {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  let last: LetterLayout | null = null;
  for (let size = MAX; size >= MIN - 1e-6; size -= 0.25) {
    last = layoutLetter(l, fonts, size);
    if (last.endY <= last.limitY) return { fits: true, size, overflowLines: 0 };
  }
  return { fits: false, size: MIN, overflowLines: Math.max(1, Math.ceil((last!.endY - last!.limitY) / last!.lineHeight)) };
}

export class LetterTooLongError extends Error {
  constructor(public overflowLines: number) { super("Cover letter does not fit on one page"); }
}

/** Always exactly one page, or throws. */
export async function renderLetterPdf(l: LetterDoc): Promise<Uint8Array> {
  const fit = await measureLetterFit(l);
  if (!fit.fits) throw new LetterTooLongError(fit.overflowLines);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${l.name || "Cover letter"} - cover letter`);
  const fonts = await loadFonts(pdf);
  const lay = layoutLetter(l, fonts, fit.size);
  await draw({ ops: lay.ops, pages: 1, endY: lay.endY, fits: true, lineHeight: lay.lineHeight, limitY: lay.limitY }, pdf, fonts);
  if (pdf.getPageCount() !== 1) throw new LetterTooLongError(1);
  return await pdf.save();
}

const tw = (pt: number) => Math.round(pt * 20);

export async function renderLetterDocx(l: LetterDoc): Promise<Buffer> {
  const fit = await measureLetterFit(l);
  if (!fit.fits) throw new LetterTooLongError(fit.overflowLines);
  const size = fit.size;
  const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font: "Arial", size: Math.round((o.size ?? size) * 2), bold: o.bold, color: o.color });
  const sp = (before = 0, mult = 1.38, sz = size) => ({ before: tw(before), after: 0, line: tw(sz * mult), lineRule: LineRuleType.EXACT });
  const kids: Paragraph[] = [
    new Paragraph({ spacing: sp(0, 1.38 * 1.6 * 0.9, size * 1.6), children: [run(l.name, { bold: true, size: size * 1.6 })] }),
  ];
  if (l.contact) kids.push(new Paragraph({ spacing: sp(0), children: [run(l.contact, { size: size * 0.95, color: "4D4D59" })] }));
  kids.push(new Paragraph({ spacing: sp(0, 0.3), border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999AA3", space: 1 } }, children: [] }));
  kids.push(new Paragraph({ spacing: sp(size * 1.2), children: [run(l.date, { color: "4D4D59" })] }));
  kids.push(new Paragraph({ spacing: sp(size * 0.9), children: [run("Hiring Team")] }));
  kids.push(new Paragraph({ spacing: sp(0), children: [run(l.company)] }));
  kids.push(new Paragraph({ spacing: sp(size * 0.9), children: [run(l.greeting)] }));
  for (const p of l.paragraphs) kids.push(new Paragraph({ spacing: sp(size * 0.75), alignment: AlignmentType.LEFT, children: [run(p)] }));
  kids.push(new Paragraph({ spacing: sp(size * 0.9), children: [run(l.closing)] }));
  kids.push(new Paragraph({ spacing: sp(size * 1.1), children: [run(l.signature, { bold: true })] }));
  const m = tw(M);
  const doc = new Document({
    title: `${l.name || "Cover letter"} - cover letter`,
    sections: [{ properties: { page: { size: { width: tw(PAGE.w), height: tw(PAGE.h) }, margin: { top: m, bottom: m, left: m, right: m } } }, children: kids }],
  });
  return await Packer.toBuffer(doc);
}
