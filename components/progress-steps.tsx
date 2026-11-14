"use client";

export type Step = { id: string; label: string };

/** Live checklist: finished steps get a check, the current one a spinner. */
export function ProgressSteps({ steps, running }: { steps: Step[]; running: boolean }) {
  if (steps.length === 0) return null;
  return (
    <ol aria-live="polite" className="space-y-1.5 text-sm">
      {steps.map((st, i) => {
        const active = running && i === steps.length - 1;
        return (
          <li key={st.id} className={`flex items-center gap-2 ${active ? "text-text" : "text-muted"}`}>
            {active
              ? <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
              : <span className="shrink-0 text-success" aria-hidden>✓</span>}
            {st.label}{active ? "…" : ""}
          </li>
        );
      })}
    </ol>
  );
}
