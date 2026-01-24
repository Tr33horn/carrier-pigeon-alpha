import { NextResponse } from "next/server";

import { createSupabaseServerActionClient } from "@/app/lib/supabase/server";

export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
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
