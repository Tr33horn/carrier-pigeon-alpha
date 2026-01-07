import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

export async function POST(_req: Request, ctx: { params: { token: string } }) {
  const token = (ctx?.params?.token || "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // 1) Confirm the letter exists (helps return a clean 404 vs "ok" on nothing)
  const { data: letter, error: readErr } = await supabaseServer
    .from("letters")
    .select("id, recipient_archived_at")
    .eq("public_token", token)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  if (!letter) {
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  }

  // 2) Idempotent: if already archived for recipient, just say ok
  if (letter.recipient_archived_at) {
    return NextResponse.json({ ok: true, alreadyArchived: true });
  }

  // 3) Update by ID (safer than token in the update clause)
  const nowISO = new Date().toISOString();

  const { error: updErr } = await supabaseServer
    .from("letters")
    .update({ recipient_archived_at: nowISO })
    .eq("id", letter.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, archivedAt: nowISO });
}