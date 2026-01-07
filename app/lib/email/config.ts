export const MAIL_FROM = process.env.MAIL_FROM || "FLOK <onboarding@resend.dev>";
export const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Put shared brand bits here so templates stay consistent
export const BRAND = {
  name: "FLOK",
  // Put your logo in /public and reference with `${APP_URL}/...`
  logoUrl: `${APP_URL}/brand/flok-mark.png`,
  supportEmail: "support@flok.app", // change later if you want
};