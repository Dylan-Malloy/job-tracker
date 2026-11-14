"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function ResumeUpload({ hubId, isOwner }: { hubId: string; isOwner: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return setMsg({ ok: false, text: "Choose a file first." });
    // Browser-side check (the server re-checks the real file contents).
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      return setMsg({ ok: false, text: "Only .pdf and .docx files are accepted." });
    }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set("hubId", hubId);
    fd.set("file", file);
    const res = await fetch("/api/resumes", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Upload failed." });
    if (input.current) input.current.value = "";
    setMsg({ ok: true, text: isOwner ? "Resume saved." : "Uploaded — it stays unusable until the owner approves it." });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="text-sm font-semibold">Upload a resume</h2>
      <input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="input file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-white" />
      <p className="text-xs text-muted">.pdf or .docx only, up to 10 MB.</p>
      <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      {msg && <p role="alert" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
