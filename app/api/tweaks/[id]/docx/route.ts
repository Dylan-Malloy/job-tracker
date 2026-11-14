import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, ctx: RouteContext<"/api/tweaks/[id]/docx">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("resume_tweaks").select("tweaked_text").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const doc = new Document({
    sections: [{
      children: data.tweaked_text.split("\n").map((line: string) => new Paragraph({ children: [new TextRun(line)] })),
    }],
  });
  const buf = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": 'attachment; filename="tailored-resume.docx"',
    },
  });
}
