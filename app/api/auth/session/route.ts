import { NextResponse } from "next/server";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerReadClient();
  const { data } = await supabase.auth.getUser();
  const signedIn = !!data?.user;
  return NextResponse.json({ signedIn }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
