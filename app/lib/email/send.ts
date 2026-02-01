// lib/email/send.ts
import type { ReactElement } from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { BRAND, getMailFrom } from "./config";

type SendArgs = {
  to: string | string[];
  subject: string;
  react: ReactElement;
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

// ✅ Create one client per serverless instance (module-scope), but don’t throw at import time
let _resend: Resend | null = null;

function getResendClient() {
  if (_resend) return _resend;

  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) throw new Error("Missing RESEND_API_KEY");

  _resend = new Resend(key);
  return _resend;
}

type ResendSendResult = {
  data: { id?: string } | null;
  error: unknown | null;
  headers?: Record<string, string> | null;
};

export async function sendEmail({ to, subject, react, replyTo, tags }: SendArgs) {
  const resend = getResendClient();

  const from = getMailFrom();

  let html = "";
  let text = "";
  try {
    html = await render(react, { pretty: false });
    text = await render(react, { plainText: true });
  } catch (err) {
    console.error("EMAIL_RENDER_ERROR:", err, {
      to: asArray(to),
      subject,
      from,
      tags,
    });
    throw err;
  }

  const payload: any = {
    from,
    to: asArray(to),
    subject,
    html,
    text,
    replyTo: replyTo || BRAND.supportEmail,
    reply_to: replyTo || BRAND.supportEmail,
  };

  if (tags?.length) payload.tags = tags;

  let res: ResendSendResult;
  try {
    res = (await resend.emails.send(payload)) as unknown as ResendSendResult;
  } catch (err) {
    console.error("EMAIL_SEND_ERROR:", err, {
      to: payload.to,
      subject,
      from: payload.from,
      tags: payload.tags,
    });
    throw err;
  }

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
