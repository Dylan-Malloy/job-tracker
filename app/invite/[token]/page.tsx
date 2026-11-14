import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/invites";
import { acceptInvite } from "./actions";

const ROLE_TEXT: Record<string, string> = {
  viewer: "view the hub (view-only)",
  helper: "add job offers and upload resumes (resumes need your approval to be used)",
};

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("hub_invites")
    .select("email, role, expires_at, accepted_at, hubs(name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const valid = invite && !invite.accepted_at && new Date(invite.expires_at) > new Date();
  const hubName = (invite?.hubs as unknown as { name: string } | null)?.name ?? "a job hub";
  const mismatch = sp.e === "mismatch" || (valid && user?.email && user.email.toLowerCase() !== invite.email.toLowerCase());

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-2xl">🤝</div>
        {!valid ? (
          <>
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted">This invite link is invalid, expired, or has already been used. Ask the hub owner for a new one.</p>
          </>
        ) : mismatch ? (
          <>
            <h1 className="text-xl font-semibold">Wrong account</h1>
            <p className="mt-2 text-sm text-muted">
              This invite was created for a different email address. Log in with the email it was sent to
              ({invite.email.replace(/^(.).*(@.*)$/, "$1•••$2")}).
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Join {hubName}</h1>
            <p className="mt-2 text-sm text-muted">You&apos;ve been invited to {ROLE_TEXT[invite.role]}.</p>
            {user ? (
              <form action={acceptInvite.bind(null, token)} className="mt-5"><button className="btn w-full">Accept invite</button></form>
            ) : (
              <div className="mt-5 flex gap-2">
                <Link className="btn flex-1" href={`/login?next=/invite/${token}`}>Log in</Link>
                <Link className="btn-ghost flex-1" href={`/signup?next=/invite/${token}`}>Sign up</Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
