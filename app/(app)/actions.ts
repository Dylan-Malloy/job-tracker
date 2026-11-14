"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { HUB_COOKIE } from "@/lib/hub";

export async function setHub(hubId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("hubs").select("id").eq("id", hubId).maybeSingle();
  if (!data) return;
  (await cookies()).set(HUB_COOKIE, hubId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

type Move = "not_started" | "in_progress" | "accepted" | "denied";

/** Owner-only (enforced by RLS): move a job between lists. */
export async function moveJob(jobId: string, to: Move) {
  const supabase = await createClient();
  const patch =
    to === "accepted" || to === "denied"
      ? { status: "finished", outcome: to }
      : { status: to, outcome: null };
  await supabase.from("jobs").update(patch).eq("id", jobId);
  revalidatePath("/", "layout");
}

export async function deleteJob(jobId: string) {
  const supabase = await createClient();
  await supabase.from("jobs").delete().eq("id", jobId);
  revalidatePath("/", "layout");
}
