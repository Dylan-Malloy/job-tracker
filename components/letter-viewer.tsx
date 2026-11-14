"use client";

import { useState } from "react";

export function LetterViewer({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={`/api/cover-letters/${id}/pdf?download=1`} data-tip="Download the cover letter as a one-page PDF">Download PDF</a>
        <a className="btn-ghost" href={`/api/cover-letters/${id}/docx`} data-tip="Download the cover letter as an editable one-page Word file">Download .docx</a>
        <button className="btn-ghost" data-tip="Copy the letter text to paste into an application form"
          onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
          {copied ? "Copied" : "Copy text"}
        </button>
        <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`/api/cover-letters/${id}/pdf`} data-tip="Open the PDF in its own tab">Open full size</a>
      </div>
      <iframe title="Cover letter PDF" src={`/api/cover-letters/${id}/pdf#toolbar=0&navpanes=0&view=FitH`} loading="lazy"
        className="aspect-[8.5/11] w-full max-w-2xl rounded-lg border border-border bg-white" />
    </div>
  );
}
