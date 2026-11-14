import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, ctx: RouteContext<"/api/resumes/[id]/download">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: resume } = await supabase.from("resumes").select("storage_path, filename").eq("id", id).maybeSingle();
  if (!resume) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data } = await supabase.storage.from("resumes").createSignedUrl(resume.storage_path, 60, { download: resume.filename });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
