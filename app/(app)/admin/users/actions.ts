"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok?: boolean; error?: string; tempPassword?: string; message?: string };

const tempPassword = () => randomBytes(9).toString("base64url");
const refresh = () => revalidatePath("/admin/users");

async function ownHub(adminUserId: string) {
  const { data } = await createAdminClient().from("hubs").select("id").eq("owner_id", adminUserId).maybeSingle();
  return data?.id ?? null;
}

async function targetInfo(id: string) {
  const admin = createAdminClient();
  const [{ data: u }, { data: a }] = await Promise.all([admin.auth.admin.getUserById(id), admin.from("app_admins").select("user_id").eq("user_id", id).maybeSingle()]);
  return { user: u?.user ?? null, isAdmin: !!a };
}

/** CREATE: make a verified account directly and (optionally) give it a role in the admin's hub. Shows a one-time password. */
export async function createUser(_: Result | undefined, formData: FormData): Promise<Result> {
  const { user: me } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "none");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!["none", "helper", "viewer"].includes(role)) return { error: "Choose a role." };

  const admin = createAdminClient();
  // The database only lets invited/allow-listed emails sign up, so allow-list this one just for the creation.
  const { data: added } = await admin.from("signup_allowlist").upsert({ email }, { onConflict: "email", ignoreDuplicates: true }).select("email");
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (added?.length) await admin.from("signup_allowlist").delete().eq("email", email);
  if (error || !data.user) return { error: /already/i.test(error?.message ?? "") ? "An account with that email already exists." : (error?.message ?? "Couldn't create the user.") };

  if (role !== "none") {
    const hubId = await ownHub(me.id);
    if (hubId) await admin.from("hub_members").insert({ hub_id: hubId, user_id: data.user.id, role, member_email: email });
  }
  refresh();
  return { ok: true, tempPassword: password, message: `Account created for ${email}.` };
}

/** UPDATE: role in the admin's own hub (or remove access). */
export async function setUserRole(userId: string, role: "none" | "helper" | "viewer"): Promise<Result> {
  const { user: me } = await requireAdmin();
  if (userId === me.id) return { error: "That's you — you own this hub." };
  const hubId = await ownHub(me.id);
  if (!hubId) return { error: "You don't have a hub." };
  const admin = createAdminClient();
  if (role === "none") await admin.from("hub_members").delete().eq("hub_id", hubId).eq("user_id", userId);
  else {
    const { user } = await targetInfo(userId);
    if (!user) return { error: "User not found." };
    const { error } = await admin.from("hub_members").upsert({ hub_id: hubId, user_id: userId, role, member_email: user.email ?? null }, { onConflict: "hub_id,user_id" });
    if (error) return { error: error.message };
  }
  refresh();
  return { ok: true, message: "Role updated." };
}

/** UPDATE: suspend or restore sign-in (existing sessions stop working once they expire). */
export async function setUserBanned(userId: string, banned: boolean): Promise<Result> {
  const { user: me } = await requireAdmin();
  if (userId === me.id) return { error: "You can't suspend yourself." };
  const { isAdmin } = await targetInfo(userId);
  if (isAdmin) return { error: "Admins can't be suspended here." };
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: banned ? "User suspended." : "User restored." };
}

/** UPDATE: change the sign-in email (marked verified). */
export async function changeUserEmail(userId: string, newEmail: string): Promise<Result> {
  await requireAdmin();
  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) return { error: /already/i.test(error.message) ? "Another account already uses that email." : error.message };
  await admin.from("hub_members").update({ member_email: email }).eq("user_id", userId);
  refresh();
  return { ok: true, message: `Email changed to ${email}.` };
}

/** UPDATE: set a new temporary password, shown once. */
export async function resetUserPassword(userId: string): Promise<Result> {
  await requireAdmin();
  const password = tempPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { ok: true, tempPassword: password, message: "Password reset." };
}

/** DELETE: remove the account, its hub and data, and its stored resume files. AI spend history is kept. */
export async function deleteUser(userId: string, confirmEmail: string): Promise<Result> {
  const { user: me } = await requireAdmin();
  if (userId === me.id) return { error: "You can't delete yourself." };
  const { user, isAdmin } = await targetInfo(userId);
  if (!user) return { error: "User not found." };
  if (isAdmin) return { error: "Admins can't be deleted here." };
  if ((user.email ?? "").toLowerCase() !== confirmEmail.trim().toLowerCase()) return { error: "Type the user's exact email to confirm." };

  const admin = createAdminClient();
  const { data: hub } = await admin.from("hubs").select("id").eq("owner_id", userId).maybeSingle();
  if (hub) {
    const { data: files } = await admin.from("resumes").select("storage_path").eq("hub_id", hub.id);
    if (files?.length) await admin.storage.from("resumes").remove(files.map((f) => f.storage_path));
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: `Deleted ${user.email}.` };
}
