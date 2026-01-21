import { NextResponse } from "next/server";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

export async function POST() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "dev") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const authClient = await createSupabaseServerReadClient();
  const { data: userData } = await authClient.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const { data, error } = await supabaseServer
    .from("letters")
    .update({ sender_user_id: user.id })
    .is("sender_user_id", null)
    .eq("from_email", "dev@local.test")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: data?.length ?? 0 });
}
