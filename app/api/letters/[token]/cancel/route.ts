import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function isValidToken(token: string) {
  // keep it permissive; public_token is URL-safe
  return /^[a-zA-Z0-9_-]{6,128}$/.test(String(token || "").trim());
}

async function cancelByToken(token: string) {
  const t = String(token ?? "").trim();

  if (!t || !isValidToken(t)) {
    return NextResponse.json({ error: "Valid token required" }, { status: 400 });
  }

  // Find latest letter by this token
  const { data: letter, error: findErr } = await supabaseServer
    .from("letters")
    .select("id, canceled_at, archived_at, sent_at")
    .eq("public_token", t)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ✅ Idempotent: already canceled => ok
  if (letter.canceled_at) {
    return NextResponse.json({
      ok: true,
      canceled: true,
      already: true,
      canceled_at: letter.canceled_at,
      archived_at: letter.archived_at ?? null,
    });
  }

  // ✅ Cancel should be allowed even if archived (archived is “visibility”, canceled is “state”)
  // Also set archived_at so it disappears from normal dashboard list (unless dashboard includes canceled, which yours does).

  const nowIso = new Date().toISOString();

  // If already archived, keep that timestamp; otherwise archive now.
  const nextArchivedAt = letter.archived_at ?? nowIso;

  const { data: updated, error: updErr } = await supabaseServer
    .from("letters")
    .update({
      canceled_at: nowIso,
      archived_at: nextArchivedAt,
    })
    .eq("id", letter.id)
    .select("canceled_at, archived_at")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    canceled: true,
    canceled_at: updated?.canceled_at ?? nowIso,
    archived_at: updated?.archived_at ?? nextArchivedAt,
  });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return await cancelByToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

// Optional: allow DELETE /api/letters/cancel/:token too
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return await cancelByToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}