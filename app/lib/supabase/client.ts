// app/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${encodeURIComponent(name)}=`));

  if (!match) return undefined;
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

function setCookie(name: string, value: string, options: any = {}) {
  if (typeof document === "undefined") return;

  const opts = {
    path: "/",
    sameSite: "Lax",
    ...options,
  };

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (opts.maxAge != null) cookie += `; Max-Age=${opts.maxAge}`;
  if (opts.expires) cookie += `; Expires=${opts.expires.toUTCString()}`;
  if (opts.path) cookie += `; Path=${opts.path}`;
  if (opts.domain) cookie += `; Domain=${opts.domain}`;
  if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
  if (opts.secure) cookie += `; Secure`;

  document.cookie = cookie;
}

function removeCookie(name: string, options: any = {}) {
  setCookie(name, "", { ...options, maxAge: 0 });
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createBrowserClient(url, anonKey, {
    cookies: {
      get: (name) => getCookie(name),
      set: (name, value, options) => setCookie(name, value, options),
      remove: (name, options) => removeCookie(name, options),
    },
  });
}