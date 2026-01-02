import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

 const { data: letter, error: lErr } = await supabaseServer
  .from("letters")
  .select("*")
  .eq("public_token", token)
  .order("sent_at", { ascending: false })
  .limit(1)
  .maybeSingle();

  if (lErr || !letter) {
    return NextResponse.json(
      { error: lErr?.message ?? "Not found" },
      { status: 404 }
    );
  }

  const { data: checkpoints, error: cErr } = await supabaseServer
    .from("letter_checkpoints")
    .select("id, idx, name, at, lat, lon")
    .eq("letter_id", (letter as any).id)
    .order("idx", { ascending: true });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  // Decide delivery server-side
  const now = Date.now();
  const eta = Date.parse((letter as any).eta_at); // eta_at is ISO string in your DB
  const delivered = Number.isFinite(eta) ? now >= eta : true;

  // Hide body until delivered
  const safeLetter = delivered
    ? letter
    : { ...letter, body: null };

  return NextResponse.json({
    letter: safeLetter,
    checkpoints: checkpoints ?? [],
    delivered,
  });
}