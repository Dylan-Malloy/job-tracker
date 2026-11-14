import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderDocx } from "@/lib/resume/render-docx";
import type { ResumeDoc } from "@/lib/resume/types";

export async function GET(_: Request, ctx: RouteContext<"/api/tweaks/[id]/docx">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("resume_tweaks").select("tailored_resume").eq("id", id).maybeSingle();
  if (!data?.tailored_resume) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const doc = data.tailored_resume as ResumeDoc;
  try {
    const buf = await renderDocx(doc);
    const base = (doc.name || "resume").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "resume";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${base}-tailored.docx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't build the document." }, { status: 500 });
  }
}
