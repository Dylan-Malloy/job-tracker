"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readNdjson } from "@/lib/ndjson";
import { ProgressSteps, type Step } from "./progress-steps";

export function TailorPanel({ jobId, resumes, defaultResumeId }: {
  jobId: string; resumes: { id: string; filename: string }[]; defaultResumeId: string | null;
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(defaultResumeId ?? resumes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<{ text: string; explanation: string }[]>([]);

  async function run() {
    setBusy(true); setError(null); setViolations([]);
    setSteps([{ id: "start", label: "Starting the assistant" }]);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tweak`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resumeId }),
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
      if (!r) return setError("The connection dropped before the assistant finished. Please try again.");
      if (!r.ok) { setViolations(r.violations ?? []); return setError(r.error ?? "Something went wrong."); }
      setSteps([]);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (resumes.length === 0) {
    return <p className="text-sm text-muted">Upload and approve a resume in the Resume bank to use the assistant.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={busy}
          aria-label="Resume to tailor" data-tip="Pick which approved resume to tailor for this job">
          {resumes.map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
        </select>
        <button className="btn shrink-0" onClick={run} disabled={busy || !resumeId}
          data-tip="Rewrite this resume around the job's top requirements — one page, nothing invented">
          {busy ? "Tailoring…" : "Tailor resume"}
        </button>
      </div>
      <ProgressSteps steps={steps} running={busy} />
      <p className="text-xs text-muted">
        Only reorders, rewords, emphasizes and trims what is already true in your resume. Always one page, and every line is fact-checked against your original.
      </p>
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
