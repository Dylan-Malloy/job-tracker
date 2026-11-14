"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/(app)/account/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="card max-w-md space-y-3">
      <h2 className="text-sm font-semibold">Change password</h2>
      <div>
        <label className="label" htmlFor="pw">New password</label>
        <input id="pw" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="pw2">Repeat it</label>
        <input id="pw2" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-success">Password updated.</p>}
      <button className="btn" disabled={pending} data-tip="Save your new password">{pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}
