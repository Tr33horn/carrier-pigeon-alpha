import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  const encName = encodeURIComponent(name);
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const match = parts.find((p) => p.startsWith(`${encName}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

export function createSupabaseRouteClient(req: Request, res: NextResponse) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieHeader = req.headers.get("cookie");

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return getCookieFromHeader(cookieHeader, name);
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        // NextResponse uses delete; keep options-compatible behavior
        // by setting an expired cookie if needed.
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}
