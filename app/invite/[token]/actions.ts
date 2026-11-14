"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HUB_COOKIE } from "@/lib/hub";
import { hashToken } from "@/lib/invites";

/** Validates the invite server-side (token + signed-in email must match) and creates the membership. */
export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect(`/login?next=/invite/${token}`);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("hub_invites")
    .select("id, hub_id, email, role, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) redirect(`/invite/${token}?e=invalid`);
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) redirect(`/invite/${token}?e=mismatch`);

  const { data: hub } = await admin.from("hubs").select("owner_id").eq("id", invite.hub_id).single();
  if (hub?.owner_id !== user.id) {
    const { error } = await admin.from("hub_members").upsert(
      { hub_id: invite.hub_id, user_id: user.id, role: invite.role, member_email: user.email },
      { onConflict: "hub_id,user_id" },
    );
    if (error) redirect(`/invite/${token}?e=invalid`);
  }
  await admin.from("hub_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  (await cookies()).set(HUB_COOKIE, invite.hub_id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

/** Create an account for an invited email. The database also refuses any sign-up without a pending invite. */
export async function joinWithInvite(token: string, _: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("hub_invites")
    .select("email, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return { error: "This invite is no longer valid. Ask the hub owner for a new one." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}` },
  });
  if (error) {
    return { error: /invit/i.test(error.message) ? "This invite can't be used to create an account." : error.message };
  }
  redirect("/verify");
}
