import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses RLS — use only for narrowly scoped server tasks. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
