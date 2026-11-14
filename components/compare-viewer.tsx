"use client";

import { useState } from "react";

/** Side-by-side: original resume (left) vs. tailored one-page resume (right), both as real PDFs. */
export function CompareViewer({ tweakId }: { tweakId: string }) {
  const [hl, setHl] = useState(true);
  const q = (view: string) => `/api/tweaks/${tweakId}/pdf?view=${view}&highlight=${hl ? 1 : 0}#toolbar=0&navpanes=0&view=FitH`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2" data-tip="Mark lines that changed: red in the original, green in the tailored version">
          <input type="checkbox" checked={hl} onChange={(e) => setHl(e.target.checked)} className="accent-[var(--primary)]" />
          Highlight changes
        </label>
        {hl && (
          <span className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-red-300" />changed or trimmed</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-green-300" />new wording</span>
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {([["original", "Your original"], ["tailored", "Tailored (1 page)"]] as const).map(([view, title]) => (
          <figure key={view} className="space-y-2">
            <figcaption className="flex items-center justify-between text-sm font-medium">
              {title}
              <a className="text-xs font-normal text-accent hover:underline" target="_blank" rel="noopener noreferrer"
                href={`/api/tweaks/${tweakId}/pdf?view=${view}&highlight=${hl ? 1 : 0}`} data-tip="Open this PDF in its own tab">
                Open full size
              </a>
            </figcaption>
            <iframe title={`${title} resume PDF`} src={q(view)} loading="lazy"
              className="aspect-[8.5/11] w-full rounded-lg border border-border bg-white" />
          </figure>
        ))}
      </div>
    </div>
  );
}
