"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Revoking deletes the membership row; RLS reads it live, so access ends on the next request. Owner-only via RLS. */
export async function revokeMember(memberId: string) {
  const supabase = await createClient();
  await supabase.from("hub_members").delete().eq("id", memberId);
  revalidatePath("/sharing");
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  await supabase.from("hub_invites").delete().eq("id", inviteId);
  revalidatePath("/sharing");
}
