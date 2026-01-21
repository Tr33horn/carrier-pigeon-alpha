import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return res;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value;
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // Trigger refresh if needed
  void supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
