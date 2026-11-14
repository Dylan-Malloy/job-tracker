"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TailorPanel({ jobId, resumes, defaultResumeId }: {
  jobId: string; resumes: { id: string; filename: string }[]; defaultResumeId: string | null;
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(defaultResumeId ?? resumes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/jobs/${jobId}/tweak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resumeId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    router.refresh();
  }

  if (resumes.length === 0) {
    return <p className="text-sm text-muted">Upload and approve a resume in the Resume bank to use the assistant.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
          {resumes.map((r) => <option key={r.id} value={r.id}>{r.filename}</option>)}
        </select>
        <button className="btn shrink-0" onClick={run} disabled={busy || !resumeId}>
          {busy ? "Tailoring… (can take a minute)" : "Tailor resume"}
        </button>
      </div>
      <p className="text-xs text-muted">
        The assistant can only reword, reorder and emphasize what is already true in your resume. Results are fact-checked against the original.
      </p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
