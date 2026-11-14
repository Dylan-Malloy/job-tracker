import { NextResponse } from "next/server";
import { withUsage } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { extractResumeText } from "@/lib/resumes/text";
import { parseOriginal } from "@/lib/resume/parse-original";
import { flattenResume, type ResumeDoc } from "@/lib/resume/types";
import { generateCoverLetter, type Tone } from "@/lib/letter/generate";
import { letterText } from "@/lib/letter/types";
import { renderLetterPdf } from "@/lib/letter/render";
import { getTimeZone } from "@/lib/tz";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[id]/cover-letter">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { source?: string; tone?: string; notes?: string } | null;
  const [kind, sourceId] = (body?.source ?? "").split(":");
  if (!sourceId || (kind !== "resume" && kind !== "tweak")) return NextResponse.json({ error: "Choose a resume." }, { status: 400 });
  const tone: Tone = body?.tone === "warm" || body?.tone === "concise" ? body.tone : "professional";
  const notes = (body?.notes ?? "").trim().slice(0, 800);

  const { data: job } = await supabase.from("jobs").select("id, hub_id, company, position, requirements, description").eq("id", id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if ((await roleInHub(supabase, user.id, job.hub_id)) !== "owner") {
    return NextResponse.json({ error: "Only the hub owner can use the cover letter generator." }, { status: 403 });
  }

  const usageCtx = { userId: user.id, userEmail: user.email ?? null, hubId: job.hub_id, jobId: job.id };
  const timeZone = await getTimeZone();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      return withUsage(usageCtx, async () => {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const step = (sid: string, label: string) => send({ type: "step", id: sid, label });
      const finish = (o: object) => { send({ type: "result", ...o }); controller.close(); };
      try {
        step("load", "Loading your resume");
        let source = "";
        let label = "";
        let doc: ResumeDoc | null = null;
        if (kind === "tweak") {
          const { data: t } = await supabase.from("resume_tweaks").select("tailored_resume").eq("id", sourceId).eq("job_id", job.id).maybeSingle();
          if (!t?.tailored_resume) return finish({ ok: false, error: "That tailored resume wasn't found." });
          doc = t.tailored_resume as ResumeDoc;
          source = flattenResume(doc);
          label = "Tailored resume";
        } else {
          const { data: r } = await supabase.from("resumes").select("id, hub_id, storage_path, kind, approved, filename").eq("id", sourceId).maybeSingle();
          if (!r || r.hub_id !== job.hub_id) return finish({ ok: false, error: "Resume not found." });
          if (!r.approved) return finish({ ok: false, error: "That resume hasn't been approved yet." });
          step("read", `Reading the text in your ${r.kind.toUpperCase()}`);
          const file = await supabase.storage.from("resumes").download(r.storage_path);
          if (file.error || !file.data) return finish({ ok: false, error: "Couldn't read the resume file." });
          try {
            source = (await extractResumeText(Buffer.from(await file.data.arrayBuffer()), r.kind as "pdf" | "docx")).slice(0, 40_000);
          } catch {
            return finish({ ok: false, error: "Couldn't read text from this resume." });
          }
          if (source.length < 200) return finish({ ok: false, error: "Very little text could be read from this resume (is it a scanned image?)." });
          doc = parseOriginal(source);
          label = r.filename;
        }

        const result = await generateCoverLetter(
          { source, notes, job, tone, name: doc?.name || "Applicant", contact: doc?.contact ?? "", timeZone },
          step,
        );
        if (!result.ok) {
          return finish({
            ok: false,
            error: result.reason === "too_long"
              ? "Claude couldn't keep the letter to one page, so nothing was saved. Try the concise tone."
              : "The letter kept including claims that aren't in your resume, so it was discarded. Nothing was saved.",
            violations: result.violations,
          });
        }

        step("render", "Building your one-page PDF");
        await renderLetterPdf(result.letter);

        step("save", "Saving the letter");
        const { data: saved, error } = await supabase
          .from("cover_letters")
          .insert({ job_id: job.id, letter: result.letter, body_text: letterText(result.letter), source_label: label, created_by: user.id })
          .select("id")
          .single();
        if (error) return finish({ ok: false, error: "Couldn't save the letter." });
        step("done", "Done — your cover letter is ready");
        return finish({ ok: true, id: saved.id });
      } catch (e) {
        console.error("[cover-letter] failed:", e instanceof Error ? e.message : "unknown error");
        return finish({ ok: false, error: "The generator failed. Please try again." });
      }
      });
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
