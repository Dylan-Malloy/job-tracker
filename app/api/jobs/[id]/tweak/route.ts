import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { extractResumeText } from "@/lib/resumes/text";
import { tailorResume } from "@/lib/ai/tailor";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[id]/tweak">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { resumeId?: string } | null;
  if (!body?.resumeId) return NextResponse.json({ error: "Choose a resume." }, { status: 400 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, hub_id, company, position, requirements, description")
    .eq("id", id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  // Owner only — checked here and again by RLS on the insert below.
  if ((await roleInHub(supabase, user.id, job.hub_id)) !== "owner") {
    return NextResponse.json({ error: "Only the hub owner can use the resume assistant." }, { status: 403 });
  }

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, hub_id, storage_path, kind, approved")
    .eq("id", body.resumeId)
    .maybeSingle();
  if (!resume || resume.hub_id !== job.hub_id) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  if (!resume.approved) return NextResponse.json({ error: "That resume hasn't been approved yet." }, { status: 400 });

  const file = await supabase.storage.from("resumes").download(resume.storage_path);
  if (file.error || !file.data) return NextResponse.json({ error: "Couldn't read the resume file." }, { status: 500 });

  let original: string;
  try {
    original = await extractResumeText(Buffer.from(await file.data.arrayBuffer()), resume.kind as "pdf" | "docx");
  } catch {
    return NextResponse.json({ error: "Couldn't read text from this resume." }, { status: 422 });
  }
  if (original.length < 200) {
    return NextResponse.json({ error: "Very little text could be read from this resume (is it a scanned image?)." }, { status: 422 });
  }

  let result;
  try {
    result = await tailorResume(original.slice(0, 40_000), job);
  } catch {
    return NextResponse.json({ error: "The assistant failed. Please try again." }, { status: 502 });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "The assistant kept adding details that aren't in your resume, so the result was discarded. Nothing was saved.",
        violations: result.violations,
      },
      { status: 422 },
    );
  }

  const { data: saved, error } = await supabase
    .from("resume_tweaks")
    .insert({
      job_id: job.id,
      resume_id: resume.id,
      original_text: original,
      tweaked_text: result.tailored,
      changes: result.changes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't save the result." }, { status: 400 });
  return NextResponse.json({ status: "saved", id: saved.id });
}
