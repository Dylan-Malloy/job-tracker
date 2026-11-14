"use client";

import Link from "next/link";
import { useActionState } from "react";

type Action = (s: { error?: string } | undefined, f: FormData) => Promise<{ error?: string } | undefined>;

export function AuthForm({ mode, action, next }: { mode: "login" | "signup"; action: Action; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isLogin = mode === "login";
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-2xl">📋</div>
          <h1 className="text-2xl font-semibold">{isLogin ? "Welcome back" : "Create your hub"}</h1>
          <p className="mt-1 text-sm text-muted">
            {isLogin ? "Log in to your job application hub." : "Track every application in one place."}
          </p>
        </div>
        <form action={formAction} className="card space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8}
              autoComplete={isLogin ? "current-password" : "new-password"} className="input" />
          </div>
          {state?.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          <button className="btn w-full" disabled={pending}>
            {pending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link className="text-accent hover:underline" href={isLogin ? "/signup" : "/login"}>
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
