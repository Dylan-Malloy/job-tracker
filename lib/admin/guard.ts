import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Whether this user is a site admin (row in app_admins). Looked up with the service role. */
export const isAdminUser = cache(async (userId: string): Promise<boolean> => {
  const { data } = await createAdminClient().from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
});

/** Call at the top of every admin page and server action: never trust the UI to hide things. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdminUser(user.id))) redirect("/");
  return { supabase, user };
}
