export type Block = {
  kind: "title" | "subtitle" | "bullet" | "text";
  text: string;
  /** Right-aligned text on the same line, e.g. dates. */
  right?: string;
};
export type Section = { heading: string; blocks: Block[] };
export type ResumeDoc = { name: string; contact: string; sections: Section[] };

/** Loose comparison key: lowercase letters/digits only, so punctuation/spacing differences don't count as edits. */
export const blockKey = (b: Block) => (b.text + (b.right ?? "")).toLowerCase().replace(/[^a-z0-9]/g, "");

export function flattenResume(d: ResumeDoc): string {
  const lines = [d.name, d.contact];
  for (const s of d.sections) {
    lines.push("", s.heading.toUpperCase());
    for (const b of s.blocks) lines.push((b.kind === "bullet" ? "- " : "") + b.text + (b.right ? `  ${b.right}` : ""));
  }
  return lines.join("\n").trim();
}

/** Defensive normalization of model output into a valid ResumeDoc. */
export function coerceResume(input: unknown): ResumeDoc {
  const o = (input ?? {}) as Record<string, unknown>;
  const kinds = ["title", "subtitle", "bullet", "text"];
  const sections = Array.isArray(o.sections) ? o.sections : [];
  return {
    name: String(o.name ?? "").trim().slice(0, 120),
    contact: String(o.contact ?? "").trim().slice(0, 300),
    sections: sections
      .map((s) => {
        const sec = (s ?? {}) as Record<string, unknown>;
        const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
        return {
          heading: String(sec.heading ?? "").trim().slice(0, 80),
          blocks: blocks
            .map((b) => {
              const bl = (b ?? {}) as Record<string, unknown>;
              const kind = kinds.includes(String(bl.kind)) ? (String(bl.kind) as Block["kind"]) : "text";
              const right = bl.right ? String(bl.right).trim().slice(0, 60) : undefined;
              return { kind, text: String(bl.text ?? "").trim().slice(0, 600), ...(right ? { right } : {}) };
            })
            .filter((b) => b.text),
        };
      })
      .filter((s) => s.heading || s.blocks.length),
  };
}
