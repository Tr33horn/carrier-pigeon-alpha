import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function createSupabaseServerReadClient() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      // RSC cannot set cookies; route/actions handle it.
      set() {},
      remove() {},
    },
  });
}

export async function createSupabaseServerActionClient() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          if (process.env.NODE_ENV === "production") throw new Error("Failed to set cookie");
          // ignore if called outside a writable context
        }
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          if (process.env.NODE_ENV === "production") throw new Error("Failed to remove cookie");
          // ignore if called outside a writable context
        }
      },
    },
  });
}
