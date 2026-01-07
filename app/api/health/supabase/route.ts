import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

export async function GET() {
  try {
    // Lightweight check: can the server reach Supabase?
    // This should use SERVICE_ROLE on the server (supabaseServer).
    const { error } = await supabaseServer.from("letters").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}