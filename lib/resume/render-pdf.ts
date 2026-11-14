import { PDFDocument, rgb } from "pdf-lib";
import { blockKey, type ResumeDoc } from "./types";
import { layoutResume, loadFonts, MAX_FONT, MIN_FONT, PAGE, type Layout, type LayoutOptions, type Rgb } from "./layout";

export type FitResult = { fits: boolean; size: number; overflowLines: number };

/** Largest font size (MAX_FONT → MIN_FONT) at which the resume fits a single page. */
export async function measureFit(doc: ResumeDoc): Promise<FitResult> {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  let last: Layout | null = null;
  for (let size = MAX_FONT; size >= MIN_FONT - 1e-6; size -= 0.25) {
    last = layoutResume(doc, fonts, size, { paginate: false });
    if (last.fits) return { fits: true, size, overflowLines: 0 };
  }
  const l = last!;
  return { fits: false, size: MIN_FONT, overflowLines: Math.max(1, Math.ceil((l.endY - l.limitY) / l.lineHeight)) };
}

export class OnePageError extends Error {
  constructor(public overflowLines: number) {
    super("Resume does not fit on one page");
  }
}

export async function draw(layout: Layout, pdf: PDFDocument, fonts: Awaited<ReturnType<typeof loadFonts>>) {
  const pages = Array.from({ length: layout.pages }, () => pdf.addPage([PAGE.w, PAGE.h]));
  const c = (x: Rgb) => rgb(x[0], x[1], x[2]);
  for (const op of layout.ops) {
    const pg = pages[op.page];
    if (op.t === "hl") pg.drawRectangle({ x: op.x, y: PAGE.h - op.y - op.h, width: op.w, height: op.h, color: c(op.color), opacity: 0.55 });
    else if (op.t === "rule") pg.drawLine({ start: { x: op.x1, y: PAGE.h - op.y }, end: { x: op.x2, y: PAGE.h - op.y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.65) });
    else pg.drawText(op.text, { x: op.x, y: PAGE.h - op.y, size: op.size, font: fonts[op.font], color: c(op.color) });
  }
}

/** Tailored resume: guaranteed exactly one page, or throws OnePageError. */
export async function renderOnePagePdf(doc: ResumeDoc, highlight?: LayoutOptions["highlight"]): Promise<{ bytes: Uint8Array; size: number }> {
  const fit = await measureFit(doc);
  if (!fit.fits) throw new OnePageError(fit.overflowLines);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.name || "Resume"} - tailored resume`);
  const fonts = await loadFonts(pdf);
  const layout = layoutResume(doc, fonts, fit.size, { paginate: false, highlight });
  await draw(layout, pdf, fonts);
  if (pdf.getPageCount() !== 1) throw new OnePageError(1);
  return { bytes: await pdf.save(), size: fit.size };
}

/** Original resume re-rendered from its text (may span several pages). */
export async function renderOriginalPdf(doc: ResumeDoc, highlight?: LayoutOptions["highlight"]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.name || "Resume"} - original`);
  const fonts = await loadFonts(pdf);
  const layout = layoutResume(doc, fonts, 10, { paginate: true, highlight });
  await draw(layout, pdf, fonts);
  return await pdf.save();
}

export function highlightSets(original: ResumeDoc, tailored: ResumeDoc) {
  const keys = (d: ResumeDoc) => new Set(d.sections.flatMap((s) => s.blocks.map(blockKey)));
  const o = keys(original), t = keys(tailored);
  return {
    // lines only in the tailored version (reworded or emphasized): green
    tailored: { keys: new Set([...t].filter((k) => !o.has(k))), color: [0.72, 0.95, 0.78] as Rgb },
    // original lines that were changed or condensed away: red
    original: { keys: new Set([...o].filter((k) => !t.has(k))), color: [1, 0.8, 0.8] as Rgb },
  };
}
