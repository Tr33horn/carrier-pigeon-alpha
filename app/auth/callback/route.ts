import { NextResponse } from "next/server";
import { sanitizeNext } from "@/app/lib/authRedirect";
import { getCanonicalOrigin } from "@/app/lib/appOrigin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/route";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const next = sanitizeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  const errorParam = url.searchParams.get("error");
  const errorCode = url.searchParams.get("error_code");
  const errorDesc = url.searchParams.get("error_description");
  const origin = getCanonicalOrigin(req.url);
  const hasCode = !!code;

  // If Supabase redirected with an error (expired, access_denied, etc)
  if (errorParam || errorCode) {
    const err = errorCode || errorParam || "auth_failed";
    const reason = errorDesc || "unknown";
    const target = `/start?error=${encodeURIComponent(err)}&reason=${encodeURIComponent(
      reason
    )}&next=${encodeURIComponent(next)}`;

    const res = NextResponse.redirect(new URL(target, url.origin));
    console.log("[auth/callback] error_param", {
      hasSetCookie: res.headers.has("set-cookie"),
      next,
      origin,
      hasCode,
      errorParam,
      errorCode,
    });
    return res;
  }

  // If no code, treat as missing_code
  if (!code) {
    const target = `/start?error=missing_code&next=${encodeURIComponent(next)}`;
    const res = NextResponse.redirect(new URL(target, url.origin));
    console.log("[auth/callback] missing_code", {
      hasSetCookie: res.headers.has("set-cookie"),
      next,
      origin,
      hasCode,
      errorParam,
      errorCode,
    });
    return res;
  }

  // Create the response FIRST, bind cookies to it, then exchange
  const res = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createSupabaseRouteClient(req, res);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = `/start?error=auth_failed&reason=${encodeURIComponent(
      error.message ?? "unknown"
    )}&next=${encodeURIComponent(next)}`;
    const errRes = NextResponse.redirect(new URL(target, url.origin));
    console.log("[auth/callback] exchange_error", {
      hasSetCookie: errRes.headers.has("set-cookie"),
      next,
      origin,
      hasCode,
      errorParam,
      errorCode,
    });
    return errRes;
  }

  console.log("[auth/callback] exchange_ok", {
    hasSetCookie: res.headers.has("set-cookie"),
    next,
    origin,
    hasCode,
    errorParam,
    errorCode,
  });
  return res;
}
