import type { Block, ResumeDoc, Section } from "./types";

const BULLET = /^\s*[-•*–▪●◦>]\s+/;
const DATE_TAIL = /^(.*?)[\s,|(-]*((?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}\s*[-–—to]+\s*(?:(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}|Present|Current|Now))\)?\s*$/i;

function isHeading(line: string) {
  const t = line.trim().replace(/:$/, "");
  return t.length >= 3 && t.length <= 40 && /[A-Z]/.test(t) && t === t.toUpperCase() && !/\d{4}/.test(t);
}

/** Best-effort structure for the text extracted from the user's original resume (used for the side-by-side view). */
export function parseOriginal(text: string): ResumeDoc {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const name = lines.shift() ?? "";
  let contact = "";
  if (lines.length && (/@|\+?\d[\d\s().-]{6,}|linkedin|github|https?:/i.test(lines[0])) && !isHeading(lines[0])) {
    contact = lines.shift()!;
    while (lines.length && /@|linkedin|github|https?:|^\+?\d[\d\s().-]{6,}$/i.test(lines[0]) && !isHeading(lines[0]) && lines[0].length < 80) {
      contact += " | " + lines.shift();
    }
  }
  const sections: Section[] = [];
  let cur: Section = { heading: "", blocks: [] };
  const flush = () => { if (cur.heading || cur.blocks.length) sections.push(cur); };
  for (const line of lines) {
    if (isHeading(line)) { flush(); cur = { heading: line.replace(/:$/, ""), blocks: [] }; continue; }
    let block: Block;
    if (BULLET.test(line)) block = { kind: "bullet", text: line.replace(BULLET, "") };
    else {
      const m = line.length < 140 ? line.match(DATE_TAIL) : null;
      block = m && m[1].trim() ? { kind: "title", text: m[1].trim().replace(/[,(|-]+$/, "").trim(), right: m[2].trim() } : { kind: "text", text: line };
    }
    cur.blocks.push(block);
  }
  flush();
  return { name, contact, sections };
}
