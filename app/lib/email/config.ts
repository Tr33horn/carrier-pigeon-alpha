export const MAIL_FROM = process.env.MAIL_FROM || "FLOK <onboarding@resend.dev>";

// React Email preview doesn't always load Next env the same way.
// Prefer NEXT_PUBLIC_APP, fall back to APP_URL, then localhost in dev.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

// Shared brand bits
export const BRAND = {
  name: "FLOK",

  // ✅ Your real filenames:
  logoUrl: `${APP_URL}/brand/flok-mark.png`,
  stampUrl: `${APP_URL}/brand/flok-stamp.png`,

  supportEmail: "support@flok.app",
};