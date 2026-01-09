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

export async function sendEmail({ to, subject, react, replyTo, tags }: SendArgs) {
  const apiKey = assertEnv();
  const resend = new Resend(apiKey);

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

  const res = await resend.emails.send(payload);

  // Helpful log line (shows up in Vercel function logs + GitHub Actions output)
  if ((res as any)?.error) {
    console.error("RESEND_SEND_ERROR:", (res as any).error, {
      to: payload.to,
      subject,
    });
  } else {
    console.log("RESEND_SENT:", {
      id: (res as any)?.data?.id,
      to: payload.to,
      subject,
    });
  }

  return res;
}