import { NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/app/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // Always attempt exchange if code exists
  if (code) {
    const supabase = await createSupabaseServerActionClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Always redirect cleanly (no hash is preserved server-side anyway)
  return NextResponse.redirect(new URL(next, url.origin));
}