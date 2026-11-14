"use client";

import { useActionState } from "react";

type Action = (s: { error?: string } | undefined, f: FormData) => Promise<{ error?: string } | undefined>;

export function AuthForm({ action, next }: { action: Action; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-2xl">📋</div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to your job application hub.</p>
        </div>
        <form action={formAction} className="card space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" className="input" />
          </div>
          {state?.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          <button className="btn w-full" disabled={pending} data-tip="Log in with this email and password">
            {pending ? "Please wait…" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Job Hub is invite-only. Got an invite link? Open it to create your account.
        </p>
      </div>
    </main>
  );
}
