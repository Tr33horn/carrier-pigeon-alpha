import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { sanitizeNext } from "@/app/lib/authRedirect";
import { getCanonicalOrigin, isLocalOrigin } from "@/app/lib/appOrigin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/routeClient";

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const otpThrottle = new Map<string, number>();

function getIpFromHeaders(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return req.headers.get("x-real-ip") || "";
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const devRequestId = process.env.NEXT_PUBLIC_APP_ENV === "dev" ? randomUUID() : null;
  const requestId = devRequestId || randomUUID();
  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const nextRaw = typeof payload?.next === "string" ? payload.next : null;

  if (!email || !isEmailValid(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  let throttleKey: string | null = null;
  if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
    const ip = getIpFromHeaders(req);
    throttleKey = createHash("sha256").update(`${email}|${ip}`).digest("hex");
    const lastSentAt = otpThrottle.get(throttleKey);
    if (lastSentAt && Date.now() - lastSentAt < 30_000) {
      if (devRequestId) {
        return NextResponse.json(
          { error: "Please wait a moment before requesting another link.", requestId: devRequestId },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Please wait a moment before requesting another link." },
        { status: 429 }
      );
    }
  }

  const nextPath = sanitizeNext(nextRaw);
  const origin = getCanonicalOrigin(req.url);

  if (process.env.NODE_ENV === "production" && isLocalOrigin(origin)) {
    return NextResponse.json(
      { error: "Auth redirect origin is misconfigured. Contact support." },
      { status: 500 }
    );
  }
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
    const domain = email.split("@")[1] || "";
    const requestId = devRequestId || "local";
    console.log(
      "[auth/otp] action=sign_in_with_otp",
      `requestId=${requestId}`,
      `emailDomain=${domain || "unknown"}`,
      `nextPath=${nextPath}`,
      `redirectTo=${redirectTo}`
    );
  }

  // Create response first so Supabase cookie writes land on it
  const resPayload =
    process.env.NEXT_PUBLIC_APP_ENV === "dev" && devRequestId
      ? { ok: true, requestId: devRequestId }
      : { ok: true };
  const res = NextResponse.json(resPayload, { status: 200 });
  const supabase = await createSupabaseRouteClient(req, res);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    const durationMs = Date.now() - startedAt;
    const domain = email.split("@")[1] || "unknown";
    const msg = error.message ?? "unknown";
    const status = (error as any).status ?? "unknown";
    const code = (error as any).code ?? null;
    console.error(
      "[auth/otp] supabase_error",
      `duration_ms=${durationMs}`,
      `status=${status}`,
      `message=${msg}`,
      `emailDomain=${domain}`,
      `nextPath=${nextPath}`,
      `redirectTo=${redirectTo}`
    );
    if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
      const requestId = devRequestId || "local";
      console.log(
        "[auth/otp] error",
        `requestId=${requestId}`,
        `duration_ms=${durationMs}`,
        `status=${status}`,
        `message=${msg}`,
        `emailDomain=${domain}`,
        `nextPath=${nextPath}`,
        `redirectTo=${redirectTo}`
      );
    }
    const isRateLimited = /rate|limit|too many|429/i.test(msg);
    if (process.env.NEXT_PUBLIC_APP_ENV === "dev" && devRequestId) {
      res.headers.set("x-auth-request-id", requestId);
      res.headers.set("x-auth-otp-status", "error");
      return NextResponse.json(
        { error: msg || "Could not send link.", status, code, requestId },
        { status: isRateLimited ? 429 : 500 }
      );
    }
    const errorRes = NextResponse.json(
      { error: msg || "Could not send link.", status, code, requestId },
      { status: isRateLimited ? 429 : 500 }
    );
    errorRes.headers.set("x-auth-request-id", requestId);
    errorRes.headers.set("x-auth-otp-status", "error");
    return errorRes;
  }

  if (process.env.NEXT_PUBLIC_APP_ENV === "dev" && throttleKey) {
    otpThrottle.set(throttleKey, Date.now());
  }

  if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
    const requestId = devRequestId || "local";
    const domain = email.split("@")[1] || "unknown";
    console.log(
      "[auth/otp] ok",
      `requestId=${requestId}`,
      `duration_ms=${Date.now() - startedAt}`,
      `status=200`,
      `emailDomain=${domain}`,
      `nextPath=${nextPath}`,
      `redirectTo=${redirectTo}`
    );
    res.headers.set("x-auth-request-id", requestId);
    res.headers.set("x-auth-otp-status", "ok");
    return res;
  }
  return res;
}
