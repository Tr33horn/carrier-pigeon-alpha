"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { sanitizeNext } from "@/app/lib/authRedirect";
import { safeJson } from "@/app/lib/http";
import styles from "../start.module.css";

function normalizeEmail(raw: string) {
  // trims + removes common invisible whitespace chars
  return raw
    .replace(/\u00A0/g, " ") // nbsp -> space
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .trim();
}

function isEmailProbablyValid(email: string) {
  const v = normalizeEmail(email);
  const at = v.indexOf("@");
  if (at <= 0) return false;
  const dot = v.lastIndexOf(".");
  if (dot <= at + 1) return false;
  if (dot === v.length - 1) return false;
  return true;
}

export default function StartSignIn() {
  const params = useSearchParams();
  const nextPath = sanitizeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const cooldownActive = cooldownUntil ? nowMs < cooldownUntil : false;
  const cooldownMs = cooldownUntil ? Math.max(0, cooldownUntil - nowMs) : 0;
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  useEffect(() => {
    if (!cooldownActive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownActive]);

  async function sendLink() {
    setErr(null);
    setRequestId(null);

    const value = normalizeEmail(email);
    if (!value) {
      setErr("Enter your email.");
      return;
    }
    if (!isEmailProbablyValid(value)) {
      setErr("That email doesn't look right.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: value, next: nextPath }),
      });

      const data = await safeJson(res);
      if (res.status === 429) {
        setErr(data?.error ?? "Please wait a moment before requesting another link.");
        if (process.env.NEXT_PUBLIC_APP_ENV === "dev" && data?.requestId) {
          setRequestId(data.requestId);
        }
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Could not send sign-in link.");
      if (process.env.NEXT_PUBLIC_APP_ENV === "dev" && data?.requestId) {
        setRequestId(data.requestId);
      }
      setSent(true);
      setCooldownUntil(Date.now() + 30_000);
    } catch (e: any) {
      setErr(e?.message || "Could not send sign-in link.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`card ${styles.startCard}`}>
      <div className="cardHead" style={{ marginBottom: 10 }}>
        <div>
          <div className="kicker">FLOK</div>
          <div className="h2">Sign in</div>
          <div className="muted" style={{ marginTop: 6 }}>
            We&apos;ll email you a magic link. No passwords. No drama.
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label className="field">
          <span className="fieldLabel">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {err ? <div className="err">❌ {err}</div> : null}
        {sent ? (
          <div className="muted">
            Link sent. It can take up to a couple minutes.
            <br />
            Check Spam/Promotions. Some domains delay delivery.
          </div>
        ) : null}
        {process.env.NEXT_PUBLIC_APP_ENV === "dev" && requestId ? (
          <div className="muted">Debug: requestId {requestId}</div>
        ) : null}

        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btnPrimary" onClick={sendLink} disabled={sending || cooldownActive}>
            {sent ? (cooldownActive ? `Link sent (${cooldownSeconds}s)` : "Resend link") : sending ? "Sending..." : "Send sign-in link"}
          </button>
          {sent ? (
            <button type="button" className="btnGhost" onClick={sendLink} disabled={sending || cooldownActive}>
              {cooldownActive ? `Resend in ${cooldownSeconds}s` : "Resend"}
            </button>
          ) : null}
        </div>

        <div className="muted" style={{ fontSize: 12, opacity: 0.75 }}>
          After you click the link, you&apos;ll return to: <strong>{nextPath}</strong>
        </div>
      </div>
    </div>
  );
}
