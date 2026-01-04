import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function isValidToken(token: string) {
  // keep it permissive; public_token is URL-safe
  return /^[a-zA-Z0-9_-]{6,128}$/.test(token.trim());
}

async function archiveByToken(token: string) {
  const t = String(token ?? "").trim();

  if (!t || !isValidToken(t)) {
    return NextResponse.json({ error: "Valid token required" }, { status: 400 });
  }

  // Find the latest letter by this token
  const { data: letter, error: findErr } = await supabaseServer
    .from("letters")
    .select("id, archived_at")
    .eq("public_token", t)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: if already archived, return success
  if (letter.archived_at) {
    return NextResponse.json({ ok: true, archived: true, archived_at: letter.archived_at });
  }

  // Archive it
  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await supabaseServer
    .from("letters")
    .update({ archived_at: nowIso })
    .eq("id", letter.id)
    .select("archived_at")
    .single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    archived: true,
    archived_at: updated?.archived_at ?? nowIso,
  });
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return await archiveByToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// Optional: allow DELETE /api/letters/archive/:token too
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return await archiveByToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}