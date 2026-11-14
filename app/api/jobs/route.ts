import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { normalizeJobUrl } from "@/lib/jobs/normalize";
import { findDuplicate } from "@/lib/jobs/duplicate";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = (await req.json().catch(() => null)) as {
    hubId?: string; url?: string; company?: string; position?: string;
    requirements?: string[]; description?: string;
  } | null;
  if (!b?.hubId || !b.url) return NextResponse.json({ error: "Missing hub or link." }, { status: 400 });

  const role = await roleInHub(supabase, user.id, b.hubId);
  if (role !== "owner" && role !== "helper") {
    return NextResponse.json({ error: "You can't add jobs to this hub." }, { status: 403 });
  }

  let normalized: string;
  try {
    normalized = normalizeJobUrl(b.url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const company = (b.company ?? "").trim().slice(0, 200);
  const position = (b.position ?? "").trim().slice(0, 300);
  if (!company || !position) return NextResponse.json({ error: "Company and position are required." }, { status: 400 });

  const { error } = await supabase.from("jobs").insert({
    hub_id: b.hubId,
    url: b.url.trim(),
    normalized_url: normalized,
    company,
    position,
    requirements: (b.requirements ?? []).map((r) => String(r).trim()).filter(Boolean).slice(0, 80),
    description: b.description?.slice(0, 15_000) ?? null,
    status: "not_started",
    added_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      const dup = await findDuplicate(supabase, b.hubId, normalized);
      return NextResponse.json({ status: "duplicate", list: dup?.list ?? "your hub" });
    }
    return NextResponse.json({ error: "Couldn't save the job." }, { status: 400 });
  }
  return NextResponse.json({ status: "saved" });
}
