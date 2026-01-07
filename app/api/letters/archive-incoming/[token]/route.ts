import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // 1) Read current state (idempotent + nicer UX)
  const { data: row, error: readErr } = await supabaseServer
    .from("letters")
    .select("id, recipient_archived_at")
    .eq("public_token", token)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  }

  if (row.recipient_archived_at) {
    return NextResponse.json({ ok: true, alreadyArchived: true });
  }

  // 2) Archive for recipient
  const { error: updErr } = await supabaseServer
    .from("letters")
    .update({ recipient_archived_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyArchived: false });
}