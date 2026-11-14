import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { highlightSets, renderOnePagePdf, renderOriginalPdf } from "@/lib/resume/render-pdf";
import type { ResumeDoc } from "@/lib/resume/types";

export const maxDuration = 30;

export async function GET(req: Request, ctx: RouteContext<"/api/tweaks/[id]/pdf">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const view = url.searchParams.get("view") === "original" ? "original" : "tailored";
  const highlight = url.searchParams.get("highlight") === "1";
  const download = url.searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data } = await supabase.from("resume_tweaks").select("tailored_resume, original_resume").eq("id", id).maybeSingle();
  if (!data?.tailored_resume || !data.original_resume) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const tailored = data.tailored_resume as ResumeDoc;
  const original = data.original_resume as ResumeDoc;
  const sets = highlightSets(original, tailored);

  try {
    const bytes = view === "original"
      ? await renderOriginalPdf(original, highlight ? sets.original : undefined)
      : (await renderOnePagePdf(tailored, highlight ? sets.tailored : undefined)).bytes;
    const base = (tailored.name || "resume").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "resume";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${base}-${view === "original" ? "original" : "tailored"}.pdf"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't render the PDF." }, { status: 500 });
  }
}
