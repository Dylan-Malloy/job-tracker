import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsageRow } from "./spend";

export const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export function parseRange(v: string | string[] | undefined) {
  const key = typeof v === "string" ? v : "90";
  return RANGES.find((r) => r.key === key) ?? RANGES[1];
}

/** AI usage rows (newest first), read with the service role. Capped to keep pages fast. */
export async function fetchUsage(limit = 5000): Promise<UsageRow[]> {
  const { data } = await createAdminClient()
    .from("ai_usage")
    .select("created_at, user_id, user_email, feature, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as UsageRow[];
}

export type SiteUser = {
  id: string; email: string; createdAt: string; lastSignInAt: string | null; confirmed: boolean; bannedUntil: string | null;
  isAdmin: boolean; role: "owner-self" | "helper" | "viewer" | null; jobsAdded: number; spend30d: number;
};

/** Every account with admin/role flags, how many jobs they added, and their 30-day AI spend. */
export async function fetchUsers(adminUserId: string, ownHubId: string | null): Promise<SiteUser[]> {
  const admin = createAdminClient();
  const all: User[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    all.push(...(data?.users ?? []));
    if (!data || data.users.length < 200) break;
  }
  const [{ data: admins }, { data: members }, { data: jobs }, usage] = await Promise.all([
    admin.from("app_admins").select("user_id"),
    ownHubId ? admin.from("hub_members").select("user_id, role").eq("hub_id", ownHubId) : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    admin.from("jobs").select("added_by"),
    fetchUsage(),
  ]);
  const adminIds = new Set((admins ?? []).map((a) => a.user_id));
  const roles = new Map((members ?? []).map((m) => [m.user_id, m.role as "helper" | "viewer"]));
  const jobCount = new Map<string, number>();
  (jobs ?? []).forEach((j) => jobCount.set(j.added_by, (jobCount.get(j.added_by) ?? 0) + 1));
  const since = Date.now() - 30 * 86_400_000;
  const spend = new Map<string, number>();
  usage.filter((u) => u.user_id && new Date(u.created_at).getTime() >= since)
    .forEach((u) => spend.set(u.user_id!, (spend.get(u.user_id!) ?? 0) + Number(u.cost_usd)));

  return all
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
      isAdmin: adminIds.has(u.id),
      role: u.id === adminUserId ? ("owner-self" as const) : (roles.get(u.id) ?? null),
      jobsAdded: jobCount.get(u.id) ?? 0,
      spend30d: spend.get(u.id) ?? 0,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
