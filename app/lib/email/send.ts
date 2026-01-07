import { Resend } from "resend";
import { render } from "@react-email/render";
import { MAIL_FROM } from "./config";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendArgs = {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
};

export async function sendEmail({ to, subject, react, replyTo }: SendArgs) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const html = await render(react);

  return resend.emails.send({
    from: MAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}