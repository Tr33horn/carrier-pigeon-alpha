// lib/email/config.ts

/**
 * Email + branding config
 * - Avoid silent fallbacks that break deliverability.
 * - Ensure APP_URL is always a usable absolute URL.
 */

function isValidMailFrom(v: string) {
  // Accepts: "Name <email@domain.com>" or just "email@domain.com"
  // (Resend accepts both; we recommend the Name <...> form.)
  const s = v.trim();

  const angle = /^.+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(s);
  const plain = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  return angle || plain;
}

function resolveAppUrl() {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL ||
    "";

  // If VERCEL_URL is set, it may be like "my-app.vercel.app" (no protocol)
  const withProto =
    env && !env.startsWith("http://") && !env.startsWith("https://")
      ? `https://${env}`
      : env;

  if (withProto) return withProto.replace(/\/$/, "");

  // Dev fallback only
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  // In prod, no fallback: force you to set it (prevents broken links in emails)
  throw new Error(
    "APP_URL is not set. Set APP_URL (or NEXT_PUBLIC_APP_URL) in your environment."
  );
}

// ✅ Require MAIL_FROM (no silent resend.dev fallback)
const mailFrom = (process.env.MAIL_FROM || "").trim();
if (!mailFrom) {
  throw new Error(
    "MAIL_FROM is not set. Set MAIL_FROM to something like: FLOK <pigeon@send.pigeon.humanrobotalliance.com>"
  );
}
if (!isValidMailFrom(mailFrom)) {
  throw new Error(
    `MAIL_FROM is invalid: "${mailFrom}". Use "Name <email@domain.com>" or "email@domain.com".`
  );
}

export const MAIL_FROM = mailFrom;

// ✅ Always absolute (no empty string surprises)
export const APP_URL = resolveAppUrl();

// Shared brand bits
export const BRAND = {
  name: "FLOK",

  // ✅ Your real filenames:
  logoUrl: `${APP_URL}/brand/flok-mark.png`,
  stampUrl: `${APP_URL}/brand/flok-stamp.png`,

  supportEmail: "support@flok.app",
};