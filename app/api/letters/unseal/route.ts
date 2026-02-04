import { NextResponse } from "next/server";

import { createSupabaseServerActionClient } from "@/app/lib/supabase/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const authDisabled = process.env.OPEN_LETTER_AUTH_DISABLED === "1";
  if (authDisabled) {
    const { data: letter, error } = await supabaseServer
      .from("letters")
      .select("id, eta_at, canceled_at, opened_at")
      .eq("public_token", token)
      .maybeSingle();

    if (error || !letter?.id) {
      return NextResponse.json({ error: "invalid_or_expired" }, { status: 404 });
    }

    if (letter.canceled_at) {
      return NextResponse.json({ error: "canceled" }, { status: 400 });
    }

    if (letter.eta_at) {
      const etaMs = new Date(letter.eta_at).getTime();
      if (Number.isFinite(etaMs) && Date.now() < etaMs) {
        return NextResponse.json({ error: "not_arrived" }, { status: 400 });
      }
    }

    if (!letter.opened_at) {
      const { error: openErr } = await supabaseServer
        .from("letters")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", letter.id);
      if (openErr) {
        return NextResponse.json({ error: "open_failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, bypass: true });
  }

  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { error } = await supabase.rpc("open_letter_by_public_token", { p_token: token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
