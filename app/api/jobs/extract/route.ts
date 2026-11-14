import { NextResponse } from "next/server";
import { withUsage } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";
import { roleInHub } from "@/lib/hub";
import { normalizeJobUrl } from "@/lib/jobs/normalize";
import { findDuplicate } from "@/lib/jobs/duplicate";
import { classifyUnreadable, fetchPage, htmlToText } from "@/lib/jobs/fetch-page";
import { extractJob } from "@/lib/jobs/extract";

export const maxDuration = 60;

const REASON_TEXT: Record<string, string> = {
  login_wall: "This page is behind a login wall.",
  blocked: "This site blocked automated access.",
  js_only: "This page only renders with JavaScript, so its content can't be read.",
  unreachable: "We couldn't read any job content from this page.",
  http_error: "The site refused or couldn't serve the page.",
  network: "We couldn't reach this page.",
  not_html: "This link doesn't point to a web page.",
  blocked_address: "This link can't be fetched.",
  bad_url: "That doesn't look like a valid link.",
  not_job: "That page doesn't look like a job posting.",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { hubId?: string; url?: string; pastedText?: string } | null;
  if (!body?.hubId || !body.url) return NextResponse.json({ error: "Missing hub or link." }, { status: 400 });

  const role = await roleInHub(supabase, user.id, body.hubId);
  if (role !== "owner" && role !== "helper") {
    return NextResponse.json({ error: "You can't add jobs to this hub." }, { status: 403 });
  }

  let normalized: string;
  try {
    normalized = normalizeJobUrl(body.url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const usageCtx = { userId: user.id, userEmail: user.email ?? null, hubId: body.hubId };
  // Stream progress as newline-delimited JSON so the UI can say what is happening.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      return withUsage(usageCtx, async () => {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const step = (id: string, label: string) => send({ type: "step", id, label });
      const done = (payload: object) => { send({ type: "result", ...payload }); controller.close(); };
      try {
        step("dup", "Checking whether this job is already in your hub");
        const dup = await findDuplicate(supabase, body.hubId!, normalized);
        if (dup) return done({ status: "duplicate", list: dup.list });

        let text = body.pastedText?.trim() ?? "";
        if (text) {
          step("read", "Reading the description you pasted");
          text = text.slice(0, 60_000);
        } else {
          step("fetch", "Opening the job page");
          const page = await fetchPage(normalized);
          if (!page.ok) {
            return done({ status: "needs_paste", reason: page.reason, message: REASON_TEXT[page.reason] });
          }
          step("read", "Reading the page and pulling out the job text");
          const { text: pageText, hasJobPosting } = htmlToText(page.body);
          const unreadable = classifyUnreadable(page.body, pageText, hasJobPosting);
          if (unreadable) {
            return done({ status: "needs_paste", reason: unreadable, message: REASON_TEXT[unreadable] });
          }
          text = pageText;
        }

        step("ai", "Asking Claude to find the company, position and requirements");
        try {
          const job = await extractJob(text);
          if (!job.isJobPosting || (!job.position && !job.requirements.length)) {
            return done({ status: "needs_paste", reason: "not_job", message: REASON_TEXT.not_job });
          }
          step("ready", "Done — ready for your review");
          return done({
            status: "ok",
            url: body.url!.trim(),
            company: job.company,
            position: job.position,
            requirements: job.requirements,
            description: text.slice(0, 15_000),
          });
        } catch (e) {
          console.error("[extract] AI extraction failed:", e instanceof Error ? e.message : "unknown error");
          return done({
            status: "needs_paste",
            reason: "ai_error",
            message: "The AI extraction step failed. You can paste the description or fill the fields in manually.",
          });
        }
      } catch {
        return done({ status: "needs_paste", reason: "network", message: REASON_TEXT.network });
      }
      });
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
