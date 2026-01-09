// lib/email/send.ts
import React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { MAIL_FROM, BRAND } from "./config";

type SendArgs = {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
  /**
   * Optional: add tags/metadata for easier filtering in Resend logs.
   * (Only used if your Resend SDK supports it; harmless otherwise.)
   */
  tags?: { name: string; value: string }[];
};

function asArray(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

function assertEnv() {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return key;
}

// ✅ Create one client per serverless instance (not per email)
const resend = new Resend(assertEnv());

/**
 * Resend typically returns:
 *  - success: { data: { id: string }, error: null, headers?: ... }
 *  - failure: { data: null, error: {...}, headers?: ... }
 *
 * We'll normalize to something easy to log + return.
 */
type ResendSendResult = {
  data: { id?: string } | null;
  error: unknown | null;
  headers?: Record<string, string> | null;
};

export async function sendEmail({ to, subject, react, replyTo, tags }: SendArgs) {
  // HTML + text improves deliverability & lets recipients preview cleanly
  const html = await render(react, { pretty: false });
  const text = await render(react, { plainText: true });

  const payload: any = {
    from: MAIL_FROM,
    to: asArray(to),
    subject,
    html,
    text,
    // Support both shapes across SDK versions
    replyTo: replyTo || BRAND.supportEmail,
    reply_to: replyTo || BRAND.supportEmail,
  };

  // Optional tags if supported by your SDK/account
  if (tags?.length) payload.tags = tags;

  // ✅ TS-safe cast: convert to unknown first
  const res = (await resend.emails.send(payload)) as unknown as ResendSendResult;

  // Helpful log line (shows up in Vercel function logs + GitHub Actions output)
  if (res?.error) {
    console.error("RESEND_SEND_ERROR:", res.error, {
      to: payload.to,
      subject,
      from: payload.from,
      hasText: Boolean(payload.text),
      tags: payload.tags,
    });
  } else {
    console.log("RESEND_SENT:", {
      id: res?.data?.id,
      to: payload.to,
      subject,
      from: payload.from,
      tags: payload.tags,
    });
  }

  return res;
}