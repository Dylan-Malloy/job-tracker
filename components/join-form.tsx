"use client";

import { useActionState } from "react";

type Action = (s: { error?: string } | undefined, f: FormData) => Promise<{ error?: string } | undefined>;

export function JoinForm({ action, email }: { action: Action; email: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3 text-left">
      <div>
        <label className="label" htmlFor="join-email">Email</label>
        <input id="join-email" className="input opacity-80" value={email} readOnly aria-readonly="true" />
      </div>
      <div>
        <label className="label" htmlFor="join-password">Choose a password</label>
        <input id="join-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {state?.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending} data-tip="Create your account — we'll email a link to verify it">
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
