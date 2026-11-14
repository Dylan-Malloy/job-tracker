"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteForm({ hubId }: { hubId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setLink(null);
    const res = await fetch("/api/invites", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hubId, email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setLink(data.link); setEmail(""); setCopied(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-sm font-semibold">Invite someone</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" type="email" required placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input sm:!w-48" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="viewer">View-only</option>
          <option value="helper">Helper</option>
        </select>
        <button className="btn shrink-0" disabled={busy} data-tip="Create a one-time invite link to share with this person" data-tip-end>{busy ? "Creating…" : "Create invite"}</button>
      </div>
      <p className="text-xs text-muted">
        You&apos;ll get a one-time link to share (valid 7 days). It only works when they sign in with this exact email.
      </p>
      {link && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <p className="mb-2 text-muted">Share this link — it won&apos;t be shown again:</p>
          <div className="flex gap-2">
            <input readOnly className="input font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-ghost shrink-0" data-tip="Copy the invite link" data-tip-end
              onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
