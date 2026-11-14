"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  changeUserEmail, createUser, deleteUser, resetUserPassword, setUserBanned, setUserRole, type Result,
} from "@/app/(app)/admin/users/actions";
import type { SiteUser } from "@/lib/admin/data";

export type UserView = SiteUser & { createdLabel: string; lastLabel: string };

function Secret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
      <p className="mb-2 text-muted">Temporary password — shown once. Share it privately; they can change it on the Account page.</p>
      <div className="flex gap-2">
        <input readOnly className="input font-mono text-xs" value={value} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn-ghost shrink-0" data-tip="Copy the temporary password" data-tip-end
          onClick={() => { navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

function AddUser() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-sm font-semibold">Add a user</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="person@example.com" className="input" aria-label="Email" />
        <select name="role" defaultValue="none" className="input sm:!w-56" aria-label="Role in your hub">
          <option value="none">No access to my hub</option>
          <option value="helper">Helper on my hub</option>
          <option value="viewer">View-only on my hub</option>
        </select>
        <button className="btn shrink-0" disabled={pending} data-tip="Create a verified account now and get a one-time temporary password" data-tip-end>{pending ? "Creating…" : "Create user"}</button>
      </div>
      <p className="text-xs text-muted">Creates the account immediately (no email needed). Everyone else can only join through an invite link.</p>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-success">{state.message}</p>}
      {state?.tempPassword && <Secret value={state.tempPassword} />}
    </form>
  );
}

function Row({ u, selfId }: { u: UserView; selfId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  const [email, setEmail] = useState(u.email);
  const [confirm, setConfirm] = useState("");
  const isSelf = u.id === selfId;
  const suspended = !!u.bannedUntil && new Date(u.bannedUntil) > new Date();
  const run = (fn: () => Promise<Result>) => start(async () => { setRes(await fn()); });

  return (
    <>
      <tr className="border-t border-border/60 align-middle">
        <td className="py-2.5 pr-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>{u.email}</span>
            {isSelf && <span className="badge">You</span>}
            {u.isAdmin && <span className="badge !border-primary/50 !text-primary-hover">Admin</span>}
            {suspended && <span className="badge !border-red-400/40 !text-red-300">Suspended</span>}
            {!u.confirmed && <span className="badge !border-yellow-400/40 !text-yellow-300">Unverified</span>}
          </div>
        </td>
        <td className="py-2.5 pr-3 text-muted">{isSelf ? "Owner" : u.role === "helper" ? "Helper" : u.role === "viewer" ? "View-only" : "—"}</td>
        <td className="whitespace-nowrap py-2.5 pr-3 text-muted">{u.createdLabel}</td>
        <td className="whitespace-nowrap py-2.5 pr-3 text-muted">{u.lastLabel}</td>
        <td className="py-2.5 pr-3 tabular-nums">{u.jobsAdded}</td>
        <td className="py-2.5 pr-3 tabular-nums">${u.spend30d.toFixed(u.spend30d < 1 ? 4 : 2)}</td>
        <td className="py-2.5 text-right">
          <button className="btn-ghost !py-1" onClick={() => { setOpen(!open); setRes(null); }} aria-expanded={open}
            data-tip="Edit this user: role, email, password, suspend or delete" data-tip-end>{open ? "Close" : "Manage"}</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-2/40">
          <td colSpan={7} className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor={`role-${u.id}`}>Role in your hub</label>
                <div className="flex gap-2">
                  <select id={`role-${u.id}`} className="input" defaultValue={isSelf ? "none" : u.role ?? "none"} disabled={isSelf || pending}
                    onChange={(e) => run(() => setUserRole(u.id, e.target.value as "none" | "helper" | "viewer"))}>
                    {isSelf && <option value="none">Owner (you)</option>}
                    <option value="none">No access</option><option value="helper">Helper</option><option value="viewer">View-only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor={`email-${u.id}`}>Email</label>
                <div className="flex gap-2">
                  <input id={`email-${u.id}`} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button className="btn-ghost shrink-0" disabled={pending || email === u.email} onClick={() => run(() => changeUserEmail(u.id, email))}
                    data-tip="Change the email this person signs in with">Save</button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" disabled={pending} onClick={() => run(() => resetUserPassword(u.id))}
                data-tip="Set a new temporary password and show it once">Reset password</button>
              {!isSelf && !u.isAdmin && (
                <button className="btn-ghost" disabled={pending} onClick={() => run(() => setUserBanned(u.id, !suspended))}
                  data-tip={suspended ? "Allow this person to sign in again" : "Block this person from signing in"}>{suspended ? "Restore access" : "Suspend"}</button>
              )}
            </div>
            {!isSelf && !u.isAdmin && (
              <div className="rounded-lg border border-danger/40 p-3">
                <p className="mb-2 text-sm text-danger">Delete this user, their hub, jobs, resumes and files. This can&apos;t be undone.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="input" placeholder={`Type ${u.email} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm email to delete" />
                  <button className="btn-danger shrink-0" disabled={pending || confirm.trim().toLowerCase() !== u.email.toLowerCase()}
                    onClick={() => run(() => deleteUser(u.id, confirm))} data-tip="Permanently delete this user and all their data" data-tip-end>Delete user</button>
                </div>
              </div>
            )}
            {res?.error && <p role="alert" className="text-sm text-danger">{res.error}</p>}
            {res?.ok && <p role="status" className="text-sm text-success">{res.message}</p>}
            {res?.tempPassword && <Secret value={res.tempPassword} />}
          </td>
        </tr>
      )}
    </>
  );
}

export function UsersTable({ users, selfId }: { users: UserView[]; selfId: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"created" | "last" | "spend" | "jobs">("created");
  const rows = useMemo(() => {
    const f = users.filter((u) => u.email.toLowerCase().includes(q.trim().toLowerCase()));
    const by = { created: (u: UserView) => u.createdAt, last: (u: UserView) => u.lastSignInAt ?? "", spend: (u: UserView) => u.spend30d, jobs: (u: UserView) => u.jobsAdded }[sort];
    return [...f].sort((a, b) => (by(a) < by(b) ? 1 : by(a) > by(b) ? -1 : 0));
  }, [users, q, sort]);

  return (
    <div className="space-y-6">
      <AddUser />
      <section className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">All users <span className="font-normal text-muted">({users.length})</span></h2>
          <div className="flex gap-2">
            <input className="input !w-56" placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort users" data-tip="Choose how to sort the table" data-tip-end>
              <option value="created">Newest first</option><option value="last">Last sign-in</option><option value="spend">AI spend (30d)</option><option value="jobs">Jobs added</option>
            </select>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>{["User", "Role in your hub", "Joined", "Last sign-in", "Jobs added", "AI spend (30d)", ""].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((u) => <Row key={u.id} u={u} selfId={selfId} />)}
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No users match.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
