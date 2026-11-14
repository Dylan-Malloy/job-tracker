"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Owner-only: RLS rejects the update for anyone else. */
export async function setResumeApproval(id: string, approved: boolean) {
  const supabase = await createClient();
  await supabase.from("resumes").update({ approved }).eq("id", id);
  revalidatePath("/resumes");
}

export async function deleteResume(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("resumes").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (!error) await supabase.storage.from("resumes").remove([data.storage_path]);
  revalidatePath("/resumes");
}
