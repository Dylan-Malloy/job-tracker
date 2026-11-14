"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Owner-only (RLS). The DB trigger also requires the resume to be approved and in the same hub. */
export async function setJobResume(jobId: string, formData: FormData) {
  const v = String(formData.get("resumeId") ?? "");
  const supabase = await createClient();
  await supabase.from("jobs").update({ resume_id: v || null }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}
