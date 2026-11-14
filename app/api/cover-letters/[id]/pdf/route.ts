import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderLetterPdf } from "@/lib/letter/render";
import type { LetterDoc } from "@/lib/letter/types";

export async function GET(req: Request, ctx: RouteContext<"/api/cover-letters/[id]/pdf">) {
  const { id } = await ctx.params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const supabase = await createClient();
  const { data } = await supabase.from("cover_letters").select("letter").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const letter = data.letter as LetterDoc;
  try {
    const bytes = await renderLetterPdf(letter);
    const base = (letter.name || "cover-letter").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cover-letter";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${base}-cover-letter.pdf"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't render the PDF." }, { status: 500 });
  }
}
