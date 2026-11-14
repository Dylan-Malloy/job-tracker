import type { SupabaseClient } from "@supabase/supabase-js";

export const LIST_LABEL: Record<string, string> = {
  not_started: "NOT STARTED",
  in_progress: "IN-PROGRESS",
  finished: "FINISHED",
};

export async function findDuplicate(supabase: SupabaseClient, hubId: string, normalizedUrl: string) {
  const { data } = await supabase
    .from("jobs")
    .select("id, status, company, position")
    .eq("hub_id", hubId)
    .eq("normalized_url", normalizedUrl)
    .maybeSingle();
  return data ? { id: data.id as string, list: LIST_LABEL[data.status as string] ?? String(data.status) } : null;
}
