import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import { blockKey, type ResumeDoc } from "./types";

export const PAGE = { w: 612, h: 792, margin: 46 }; // US Letter, ~0.64in margins
export const MIN_FONT = 9;
export const MAX_FONT = 10.5;
/** Use at most 95% of the page height so Word/PDF renderers differing slightly can't spill to page 2. */
export const SAFETY = 0.95;

export type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };
export type Rgb = [number, number, number];
export type Op =
  | { t: "text"; page: number; x: number; y: number; text: string; font: keyof Fonts; size: number; color: Rgb }
  | { t: "rule"; page: number; x1: number; x2: number; y: number }
  | { t: "hl"; page: number; x: number; y: number; w: number; h: number; color: Rgb };

export type Layout = { ops: Op[]; pages: number; endY: number; fits: boolean; lineHeight: number; limitY: number };

export async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
}

const REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", " ": " ", "•": "-", "▪": "-", "→": "->", "​": "",
};

/** Standard PDF fonts only cover WinAnsi: map common punctuation, replace anything else with "?". */
export function sanitize(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const c = REPLACEMENTS[ch] ?? ch;
    for (const piece of c) {
      if (piece === "\n" || piece === "\t") { out += " "; continue; }
      try { font.encodeText(piece); out += piece; } catch { out += "?"; }
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const push = (w: string) => {
    // hard-split a single over-long token
    while (font.widthOfTextAtSize(w, size) > maxW && w.length > 1) {
      let n = w.length - 1;
      while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxW) n--;
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    return w;
  };
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = push(w);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export type LayoutOptions = {
  paginate: boolean;
  /** Block keys to highlight, and the highlight color. */
  highlight?: { keys: Set<string>; color: Rgb };
};

export function layoutResume(doc: ResumeDoc, fonts: Fonts, size: number, opts: LayoutOptions): Layout {
  const { w: W, h: H, margin: M } = PAGE;
  const contentW = W - 2 * M;
  const lh = size * 1.22;
  const bottom = H - M;
  const limitY = M + (bottom - M) * SAFETY;
  const ops: Op[] = [];
  let page = 0;
  let y = M;
  let first = true;

  const ensure = (h: number) => {
    if (opts.paginate && y + h > bottom) { page++; y = M; first = true; }
  };
  const S = (t: string, f: PDFFont = fonts.regular) => sanitize(t, f);

  // Header
  const nameSize = size * 1.9;
  const name = S(doc.name, fonts.bold);
  if (name) {
    const nw = fonts.bold.widthOfTextAtSize(name, nameSize);
    ops.push({ t: "text", page, x: (W - Math.min(nw, contentW)) / 2, y: y + nameSize, text: name, font: "bold", size: nameSize, color: [0.07, 0.07, 0.1] });
    y += nameSize * 1.25;
  }
  const contact = S(doc.contact);
  if (contact) {
    for (const line of wrap(contact, fonts.regular, size * 0.95, contentW)) {
      const cw = fonts.regular.widthOfTextAtSize(line, size * 0.95);
      ops.push({ t: "text", page, x: (W - cw) / 2, y: y + size, text: line, font: "regular", size: size * 0.95, color: [0.3, 0.3, 0.35] });
      y += lh;
    }
  }

  for (const sec of doc.sections) {
    const heading = S(sec.heading.toUpperCase(), fonts.bold);
    ensure(size * 0.8 + lh * 3);
    if (!(first && page > 0)) y += size * 0.8;
    first = false;
    if (heading) {
      ops.push({ t: "text", page, x: M, y: y + size * 1.05, text: heading, font: "bold", size: size * 1.05, color: [0.1, 0.1, 0.16] });
      y += lh * 1.05;
      ops.push({ t: "rule", page, x1: M, x2: W - M, y: y - 1 });
      y += 3;
    }
    let prevKind: string | null = null;
    for (const b of sec.blocks) {
      const isTitle = b.kind === "title";
      const gap = isTitle && prevKind ? size * 0.35 : 0;
      const bf = isTitle ? fonts.bold : b.kind === "subtitle" ? fonts.italic : fonts.regular;
      const text = S(b.text, bf);
      const right = b.right ? S(b.right) : "";
      const rightW = right ? fonts.regular.widthOfTextAtSize(right, size) : 0;
      const indent = b.kind === "bullet" ? 11 : 0;
      const maxW = contentW - indent - (rightW ? rightW + 8 : 0);
      const lines = wrap(text, bf, size, maxW);
      ensure(gap + lh * lines.length);
      y += gap;
      const startIdx = ops.length;
      const top = y;
      lines.forEach((line, i) => {
        const baseline = y + size;
        if (b.kind === "bullet" && i === 0) {
          ops.push({ t: "text", page, x: M + 2, y: baseline, text: "-", font: "regular", size, color: [0.2, 0.2, 0.25] });
        }
        ops.push({ t: "text", page, x: M + indent, y: baseline, text: line, font: isTitle ? "bold" : b.kind === "subtitle" ? "italic" : "regular", size, color: b.kind === "subtitle" ? [0.25, 0.25, 0.3] : [0.1, 0.1, 0.14] });
        if (i === 0 && right) {
          ops.push({ t: "text", page, x: W - M - rightW, y: baseline, text: right, font: "regular", size, color: [0.3, 0.3, 0.35] });
        }
        y += lh;
      });
      if (opts.highlight?.keys.has(blockKey(b))) {
        ops.splice(startIdx, 0, { t: "hl", page, x: M - 2, y: top - 1, w: contentW + 4, h: y - top + 1, color: opts.highlight.color });
      }
      prevKind = b.kind;
    }
  }

  const pages = page + 1;
  return { ops, pages, endY: y, fits: !opts.paginate ? y <= limitY : true, lineHeight: lh, limitY };
}
