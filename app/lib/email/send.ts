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

  const maxAttempts = 3;
  const timeoutMs = 10_000;
  let res: ResendSendResult | undefined;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = (await Promise.race([
        resend.emails.send(payload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Resend send timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ])) as unknown as ResendSendResult;
      lastErr = res?.error ?? null;
      if (!lastErr) break;
      console.error("EMAIL_SEND_ERROR:", lastErr, {
        attempt,
        to: payload.to,
        subject,
        from: payload.from,
        tags: payload.tags,
      });
    } catch (err) {
      lastErr = err;
      console.error("EMAIL_SEND_ERROR:", err, {
        attempt,
        to: payload.to,
        subject,
        from: payload.from,
        tags: payload.tags,
      });
    }

    if (attempt < maxAttempts) {
      const backoffMs = 400 * attempt + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (!res) {
    throw lastErr ?? new Error("Resend send failed");
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
