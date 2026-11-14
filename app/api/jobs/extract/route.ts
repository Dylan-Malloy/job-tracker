import { NextResponse } from "next/server";
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

  const dup = await findDuplicate(supabase, body.hubId, normalized);
  if (dup) return NextResponse.json({ status: "duplicate", list: dup.list });

  let text = body.pastedText?.trim() ?? "";
  if (text) {
    text = text.slice(0, 60_000);
  } else {
    const page = await fetchPage(normalized);
    if (!page.ok) {
      return NextResponse.json({ status: "needs_paste", reason: page.reason, message: REASON_TEXT[page.reason] });
    }
    const { text: pageText, hasJobPosting } = htmlToText(page.body);
    const unreadable = classifyUnreadable(page.body, pageText, hasJobPosting);
    if (unreadable) {
      return NextResponse.json({ status: "needs_paste", reason: unreadable, message: REASON_TEXT[unreadable] });
    }
    text = pageText;
  }

  try {
    const job = await extractJob(text);
    if (!job.isJobPosting || (!job.position && !job.requirements.length)) {
      return NextResponse.json({ status: "needs_paste", reason: "not_job", message: REASON_TEXT.not_job });
    }
    return NextResponse.json({
      status: "ok",
      url: body.url.trim(),
      company: job.company,
      position: job.position,
      requirements: job.requirements,
      description: text.slice(0, 15_000),
    });
  } catch {
    return NextResponse.json(
      { status: "needs_paste", reason: "ai_error", message: "The AI extraction step failed. You can paste the description or fill the fields in manually." },
    );
  }
}
