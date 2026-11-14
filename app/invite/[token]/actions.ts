"use server";

import { cookies } from "next/headers";
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
