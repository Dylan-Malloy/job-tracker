export type LetterDoc = {
  name: string;
  contact: string;
  date: string;
  company: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
};

export function letterText(l: LetterDoc): string {
  return [l.greeting, ...l.paragraphs, l.closing, l.signature].filter(Boolean).join("\n\n");
}
