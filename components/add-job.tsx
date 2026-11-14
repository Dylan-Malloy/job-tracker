"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Draft = { url: string; company: string; position: string; requirements: string; description: string };

export function AddJob({ hubId }: { hubId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [needPaste, setNeedPaste] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(t);
  }, [banner]);

  function reset() {
    setUrl(""); setPasted(""); setNeedPaste(null); setDraft(null); setError(null);
  }

  async function extract(withPaste: boolean) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hubId, url, pastedText: withPaste ? pasted : undefined }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Something went wrong.");
      if (data.status === "duplicate") {
        setBanner(`This job offer has already been added — it's in your ${data.list} list.`);
        return;
      }
      if (data.status === "needs_paste") {
        setNeedPaste(withPaste
          ? `${data.message} Try pasting more of the job description, or fill the fields in manually.`
          : `${data.message} Paste the job description text below and we'll extract it from that instead.`);
        return;
      }
      setNeedPaste(null);
      setDraft({
        url: data.url, company: data.company, position: data.position,
        requirements: (data.requirements as string[]).join("\n"), description: data.description,
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hubId, url: draft.url, company: draft.company, position: draft.position,
        requirements: draft.requirements.split("\n"), description: draft.description,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.status === "duplicate") {
      setBanner(`This job offer has already been added — it's in your ${data.list} list.`);
      return;
    }
    if (!res.ok) return setError(data.error ?? "Couldn't save the job.");
    reset();
    router.refresh();
  }

  return (
    <>
      {banner && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss" className="text-lg leading-none">×</button>
        </div>
      )}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Add a job offer</h2>
        {!draft && (
          <form onSubmit={(e) => { e.preventDefault(); extract(false); }} className="flex flex-col gap-2 sm:flex-row">
            <input className="input" placeholder="Paste a job link (LinkedIn, Indeed, Glassdoor, careers page…)"
              value={url} onChange={(e) => setUrl(e.target.value)} required type="url" />
            <button className="btn shrink-0" disabled={busy || !url}>{busy && !needPaste ? "Reading…" : "Add"}</button>
          </form>
        )}
        {needPaste && !draft && (
          <div className="mt-3 space-y-2">
            <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{needPaste}</p>
            <textarea className="input min-h-32" placeholder="Paste the job description here…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn" disabled={busy || pasted.trim().length < 50} onClick={() => extract(true)}>
                {busy ? "Extracting…" : "Extract from text"}
              </button>
              <button className="btn-ghost" onClick={() => setDraft({ url, company: "", position: "", requirements: "", description: pasted })}>
                Fill in manually
              </button>
              <button className="btn-ghost" onClick={reset}>Cancel</button>
            </div>
          </div>
        )}
        {draft && (
          <div className="space-y-3">
            <p className="text-xs text-muted">Review and edit before saving. It will be added to NOT STARTED.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Company</label>
                <input className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
              <div><label className="label">Position</label>
                <input className="input" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} /></div>
            </div>
            <div><label className="label">Job offer link</label>
              <input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></div>
            <div><label className="label">Requirements (one per line)</label>
              <textarea className="input min-h-40" value={draft.requirements} onChange={(e) => setDraft({ ...draft, requirements: e.target.value })} /></div>
            <div className="flex gap-2">
              <button className="btn" disabled={busy || !draft.company.trim() || !draft.position.trim()} onClick={save}>
                {busy ? "Saving…" : "Save to NOT STARTED"}
              </button>
              <button className="btn-ghost" onClick={reset}>Cancel</button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </section>
    </>
  );
}
