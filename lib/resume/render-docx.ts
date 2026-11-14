import { AlignmentType, BorderStyle, Document, LineRuleType, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { PAGE } from "./layout";
import { measureFit, OnePageError } from "./render-pdf";
import type { ResumeDoc } from "./types";

const FONT = "Arial"; // metrically compatible with the Helvetica used to measure the one-page fit
const tw = (pt: number) => Math.round(pt * 20);

export async function renderDocx(doc: ResumeDoc): Promise<Buffer> {
  const fit = await measureFit(doc);
  if (!fit.fits) throw new OnePageError(fit.overflowLines);
  const size = fit.size;
  const lineTw = tw(size * 1.22);
  const contentTw = tw(PAGE.w - 2 * PAGE.margin);
  const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font: FONT, size: Math.round((o.size ?? size) * 2), bold: o.bold, italics: o.italics, color: o.color });
  const exact = (pt: number) => ({ line: tw(pt * 1.22), lineRule: LineRuleType.EXACT });

  const children: Paragraph[] = [];
  if (doc.name) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { ...exact(size * 1.9), after: 0 }, children: [run(doc.name, { bold: true, size: size * 1.9 })] }));
  }
  if (doc.contact) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: lineTw, lineRule: LineRuleType.EXACT }, children: [run(doc.contact, { size: size * 0.95, color: "4D4D59" })] }));
  }
  for (const sec of doc.sections) {
    children.push(new Paragraph({
      spacing: { before: tw(size * 0.8), after: tw(3), ...exact(size * 1.05) },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999AA3", space: 1 } },
      children: [run(sec.heading.toUpperCase(), { bold: true, size: size * 1.05 })],
    }));
    let prev: string | null = null;
    for (const b of sec.blocks) {
      const before = b.kind === "title" && prev ? tw(size * 0.35) : 0;
      const spacing = { before, after: 0, line: lineTw, lineRule: LineRuleType.EXACT };
      if (b.kind === "bullet") {
        children.push(new Paragraph({ spacing, indent: { left: tw(11), hanging: tw(9) }, tabStops: [{ type: TabStopType.LEFT, position: tw(11) }], children: [run("-\t" + b.text)] }));
      } else if (b.kind === "title") {
        children.push(new Paragraph({
          spacing, tabStops: [{ type: TabStopType.RIGHT, position: contentTw }],
          children: [run(b.text, { bold: true }), ...(b.right ? [run("\t" + b.right, { color: "4D4D59" })] : [])],
        }));
      } else {
        children.push(new Paragraph({
          spacing, tabStops: [{ type: TabStopType.RIGHT, position: contentTw }],
          children: [run(b.text, { italics: b.kind === "subtitle" }), ...(b.right ? [run("\t" + b.right, { color: "4D4D59" })] : [])],
        }));
      }
      prev = b.kind;
    }
  }
  const m = tw(PAGE.margin);
  const file = new Document({
    title: `${doc.name || "Resume"} - tailored resume`,
    sections: [{ properties: { page: { size: { width: tw(PAGE.w), height: tw(PAGE.h) }, margin: { top: m, bottom: m, left: m, right: m } } }, children }],
  });
  return await Packer.toBuffer(file);
}
