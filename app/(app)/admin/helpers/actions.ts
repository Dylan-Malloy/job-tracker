"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";

/** Uses the admin's own session, so RLS also checks they own the hub. */
export async function setMemberRole(memberId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const role = String(formData.get("role"));
  if (role !== "helper" && role !== "viewer") return;
  await supabase.from("hub_members").update({ role }).eq("id", memberId);
  revalidatePath("/admin/helpers");
}

export async function removeMember(memberId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("hub_members").delete().eq("id", memberId);
  revalidatePath("/admin/helpers");
}
