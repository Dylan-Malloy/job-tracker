import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderLetterDocx } from "@/lib/letter/render";
import type { LetterDoc } from "@/lib/letter/types";

export async function GET(_: Request, ctx: RouteContext<"/api/cover-letters/[id]/docx">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("cover_letters").select("letter").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const letter = data.letter as LetterDoc;
  try {
    const buf = await renderLetterDocx(letter);
    const base = (letter.name || "cover-letter").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cover-letter";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${base}-cover-letter.docx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't build the document." }, { status: 500 });
  }
}
