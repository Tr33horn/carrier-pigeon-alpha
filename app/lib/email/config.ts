// lib/email/config.ts

/**
 * Email + branding config
 * - Do NOT throw at module import time (breaks Next build + route boot).
 * - Validate when used (send-time), where failures are actionable.
 */

function stripWrappingQuotes(s: string) {
  const t = (s || "").trim();

  // Handles: "abc", 'abc', ""abc"", ''abc''
  const once =
    (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
      ? t.slice(1, -1).trim()
      : t;

  const twice =
    (once.startsWith('"') && once.endsWith('"')) || (once.startsWith("'") && once.endsWith("'"))
      ? once.slice(1, -1).trim()
      : once;

  return twice;
}

function isValidMailFrom(v: string) {
  // Accept: "Name <email@domain.com>" OR "email@domain.com"
  const s = v.trim();
  const angle = /^.+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(s);
  const plain = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  return angle || plain;
}

function resolveAppUrlLenient() {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.VERCEL_URL ||
    "";

  const raw = stripWrappingQuotes(env);

  // VERCEL_URL may be "my-app.vercel.app" (no protocol)
  const withProto =
    raw && !raw.startsWith("http://") && !raw.startsWith("https://") ? `https://${raw}` : raw;

  const normalized = withProto ? withProto.replace(/\/$/, "") : "";

  if (normalized) {
    if (process.env.NODE_ENV !== "development") {
      const isLocal =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized) ||
        normalized.includes("://localhost:") ||
        normalized.includes("://127.0.0.1:");
      if (isLocal) {
        console.warn("APP_URL points to localhost in production. Fix APP_URL / APP_BASE_URL / NEXT_PUBLIC_APP_URL.");
        return "";
      }
    }
    return normalized;
  }

  // Dev fallback only
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  // In prod we *can* return empty string, but callers should validate if they need absolute URLs.
  return "";
}

/**
 * ✅ Call this at send-time.
 * Throws with a clear message if misconfigured.
 */
export function getMailFrom() {
  const raw = stripWrappingQuotes(process.env.MAIL_FROM || "");
  if (!raw) {
    throw new Error(
      'MAIL_FROM is not set. Set MAIL_FROM to: FLOK <hello@mail.pigeon.humanrobotalliance.com> (no surrounding quotes)'
    );
  }
  if (!isValidMailFrom(raw)) {
    throw new Error(`MAIL_FROM is invalid: "${raw}". Use "Name <email@domain.com>" or "email@domain.com".`);
  }
  return raw;
}

/**
 * ✅ Safe URL for building absolute links in emails.
 * In prod, you should set APP_URL/APP_BASE_URL. If missing, we fall back to "" and templates can use a hard fallback.
 */
export function getAppUrl() {
  const url = resolveAppUrlLenient();
  if (!url && process.env.NODE_ENV !== "development") {
    throw new Error(
      "APP_URL is not set or invalid for production. Set APP_URL / APP_BASE_URL / NEXT_PUBLIC_APP_URL to your production domain."
    );
  }
  return url;
}

// Convenience constants (non-throwing)
export const APP_URL = getAppUrl();

// Brand bits
export const BRAND = {
  name: "FLOK",
  logoUrl: APP_URL ? `${APP_URL}/brand/flok-mark.png` : `/brand/flok-mark.png`,
  stampUrl: APP_URL ? `${APP_URL}/brand/flok-stamp.png` : `/brand/flok-stamp.png`,
  supportEmail: "support@flok.app",
};
