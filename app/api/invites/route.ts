import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { hashToken } from "@/lib/invites";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = (await req.json().catch(() => null)) as { hubId?: string; email?: string; role?: string } | null;
  const email = b?.email?.trim().toLowerCase() ?? "";
  if (!b?.hubId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (b.role !== "viewer" && b.role !== "helper") return NextResponse.json({ error: "Choose a role." }, { status: 400 });
  if ((await roleInHub(supabase, user.id, b.hubId)) !== "owner") {
    return NextResponse.json({ error: "Only the owner can invite people." }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("hub_invites").insert({
    hub_id: b.hubId,
    email,
    role: b.role,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Couldn't create the invite." }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  return NextResponse.json({ link: `${origin}/invite/${token}` });
}
