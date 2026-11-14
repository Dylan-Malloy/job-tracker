import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "helper" | "viewer";
export type HubInfo = { id: string; name: string; role: Role };

export const HUB_COOKIE = "hub_id";

/** Current user + hubs they can access + the selected hub and their role in it. */
export const getHubContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: hubRows }, { data: memberRows }] = await Promise.all([
    supabase.from("hubs").select("id, owner_id, name").order("created_at"),
    supabase.from("hub_members").select("hub_id, role").eq("user_id", user.id),
  ]);

  const roleByHub = new Map((memberRows ?? []).map((m) => [m.hub_id, m.role as Role]));
  const hubs: HubInfo[] = (hubRows ?? [])
    .map((h) => ({
      id: h.id,
      name: h.name,
      role: (h.owner_id === user.id ? "owner" : roleByHub.get(h.id)) as Role,
    }))
    .filter((h) => h.role)
    .sort((a, b) => (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0));

  const cookieStore = await cookies();
  const wanted = cookieStore.get(HUB_COOKIE)?.value;
  const current = hubs.find((h) => h.id === wanted) ?? hubs[0] ?? null;
  return { supabase, user, hubs, current };
});

/** Role of `userId` in `hubId`, evaluated live (revocation is immediate). Safe for route handlers. */
export async function roleInHub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  hubId: string,
): Promise<Role | null> {
  const [{ data: hub }, { data: member }] = await Promise.all([
    supabase.from("hubs").select("owner_id").eq("id", hubId).maybeSingle(),
    supabase.from("hub_members").select("role").eq("hub_id", hubId).eq("user_id", userId).maybeSingle(),
  ]);
  if (hub?.owner_id === userId) return "owner";
  return (member?.role as Role | undefined) ?? null;
}
