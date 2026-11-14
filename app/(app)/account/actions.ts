"use server";

import { createClient } from "@/lib/supabase/server";

export async function changePassword(_: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: /reauth|recent/i.test(error.message) ? "For security, log out and back in, then try again." : error.message };
  }
  return { ok: true };
}
