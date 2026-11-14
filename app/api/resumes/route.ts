import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleInHub } from "@/lib/hub";
import { MIME, validateResume } from "@/lib/resumes/validate";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const hubId = form?.get("hubId");
  const file = form?.get("file");
  if (typeof hubId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const role = await roleInHub(supabase, user.id, hubId);
  if (role !== "owner" && role !== "helper") {
    return NextResponse.json({ error: "You can't upload resumes to this hub." }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateResume(file.name, bytes);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const path = `${hubId}/${randomUUID()}.${check.kind}`;
  // Uploads go through the server only (no client INSERT policy on the bucket), so the checks above can't be bypassed.
  const admin = createAdminClient();
  const up = await admin.storage.from("resumes").upload(path, bytes, { contentType: MIME[check.kind], upsert: false });
  if (up.error) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });

  const isOwner = role === "owner";
  const { error } = await supabase.from("resumes").insert({
    hub_id: hubId,
    uploaded_by: user.id,
    storage_path: path,
    filename: file.name.slice(0, 200),
    kind: check.kind,
    approved: isOwner,
    approved_by: isOwner ? user.id : null,
    approved_at: isOwner ? new Date().toISOString() : null,
  });
  if (error) {
    await admin.storage.from("resumes").remove([path]);
    return NextResponse.json({ error: "Couldn't save the resume." }, { status: 400 });
  }
  return NextResponse.json({ status: "saved", approved: isOwner });
}
