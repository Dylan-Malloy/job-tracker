"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readNdjson } from "@/lib/ndjson";
import { ProgressSteps, type Step } from "./progress-steps";

export function CoverLetterPanel({ jobId, sources, defaultSource }: {
  jobId: string; sources: { value: string; label: string }[]; defaultSource: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState(defaultSource);
  const [tone, setTone] = useState("professional");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<{ text: string; explanation: string }[]>([]);

  async function run() {
    setBusy(true); setError(null); setViolations([]);
    setSteps([{ id: "start", label: "Starting the generator" }]);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, tone, notes }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? "Something went wrong.");
      }
      let result: Record<string, unknown> | null = null;
      await readNdjson(res, (ev) => {
        if (ev.type === "step") setSteps((p) => [...p, { id: String(ev.id), label: String(ev.label) }]);
        else if (ev.type === "result") result = ev;
      });
      const r = result as { ok?: boolean; error?: string; violations?: { text: string; explanation: string }[] } | null;
      if (!r) return setError("The connection dropped before the generator finished. Please try again.");
      if (!r.ok) { setViolations(r.violations ?? []); return setError(r.error ?? "Something went wrong."); }
      setSteps([]);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sources.length === 0) {
    return <p className="text-sm text-muted">Upload and approve a resume in the Resume bank to generate a cover letter.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="cl-source">Write it from</label>
          <select id="cl-source" className="input" value={source} onChange={(e) => setSource(e.target.value)} disabled={busy}
            data-tip="The letter can only use facts found in this resume">
            {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cl-tone">Tone</label>
          <select id="cl-tone" className="input sm:!w-44" value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy}
            data-tip="Choose how the letter should sound" data-tip-end>
            <option value="professional">Professional</option>
            <option value="warm">Warm</option>
            <option value="concise">Concise</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cl-notes">Anything to mention? <span className="normal-case text-muted/70">(optional)</span></label>
        <textarea id="cl-notes" className="input min-h-20" maxLength={800} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy}
          placeholder="e.g. I'm relocating to Austin in March, or why this company interests me. Only add things that are true." />
      </div>
      <button className="btn" onClick={run} disabled={busy || !source}
        data-tip="Write a one-page cover letter for this job using only what's true in your resume">
        {busy ? "Writing…" : "Generate cover letter"}
      </button>
      <ProgressSteps steps={steps} running={busy} />
      {error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <p>{error}</p>
          {violations.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-danger/90">
              {violations.slice(0, 4).map((v, i) => <li key={i}>“{v.text}” — {v.explanation}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
