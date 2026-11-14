import { NextResponse } from "next/server";
import { withUsage } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { extractResumeText } from "@/lib/resumes/text";
import { tailorResume } from "@/lib/ai/tailor";
import { PDFDocument } from "pdf-lib";
import { parseOriginal } from "@/lib/resume/parse-original";
import { renderOnePagePdf } from "@/lib/resume/render-pdf";
import { flattenResume } from "@/lib/resume/types";

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

  const usageCtx = { userId: user.id, userEmail: user.email ?? null, hubId: job.hub_id, jobId: job.id };
  // Stream progress so the UI can show what the assistant is doing.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      return withUsage(usageCtx, async () => {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const step = (id: string, label: string) => send({ type: "step", id, label });
      const finish = (o: object) => { send({ type: "result", ...o }); controller.close(); };
      try {
        step("load", "Opening your resume file");
        const file = await supabase.storage.from("resumes").download(resume.storage_path);
        if (file.error || !file.data) return finish({ ok: false, error: "Couldn't read the resume file." });

        step("read", `Reading the text in your ${resume.kind.toUpperCase()}`);
        let original: string;
        try {
          original = await extractResumeText(Buffer.from(await file.data.arrayBuffer()), resume.kind as "pdf" | "docx");
        } catch {
          return finish({ ok: false, error: "Couldn't read text from this resume." });
        }
        if (original.length < 200) {
          return finish({ ok: false, error: "Very little text could be read from this resume (is it a scanned image?)." });
        }
        original = original.slice(0, 40_000);

        const result = await tailorResume(original, job, step);
        if (!result.ok) {
          return finish({
            ok: false,
            error:
              result.reason === "too_long"
                ? "Claude couldn't fit your resume on one page without cutting too much, so nothing was saved. Try a shorter source resume."
                : "The assistant kept adding details that aren't in your resume, so the result was discarded. Nothing was saved.",
            violations: result.violations,
          });
        }

        step("render", "Building your one-page PDF");
        const { bytes } = await renderOnePagePdf(result.doc);
        if ((await PDFDocument.load(bytes)).getPageCount() !== 1) {
          return finish({ ok: false, error: "The tailored resume did not fit on one page. Nothing was saved." });
        }

        step("save", "Saving the result");
        const { data: saved, error } = await supabase
          .from("resume_tweaks")
          .insert({
            job_id: job.id,
            resume_id: resume.id,
            original_text: original,
            tweaked_text: flattenResume(result.doc),
            original_resume: parseOriginal(original),
            tailored_resume: result.doc,
            changes: result.changes,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) return finish({ ok: false, error: "Couldn't save the result." });
        step("done", "Done — your tailored resume is ready");
        return finish({ ok: true, id: saved.id });
      } catch (e) {
        console.error("[tweak] failed:", e instanceof Error ? e.message : "unknown error");
        return finish({ ok: false, error: "The assistant failed. Please try again." });
      }
      });
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
