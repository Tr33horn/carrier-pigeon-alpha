"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  status: number;
  requestId?: string;
  error?: string;
  sentAt: string;
  emailDomain?: string;
};

export default function AuthOtpDebugClient() {
  const [email, setEmail] = useState("");
  const [nextPath, setNextPath] = useState("/inbox");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send() {
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, next: nextPath }),
      });

      const data = await res.json().catch(() => ({}));
      const domain = email.includes("@") ? email.split("@")[1] : "";

      setResult({
        ok: res.ok,
        status: res.status,
        requestId: data?.requestId,
        error: data?.error,
        sentAt: new Date().toLocaleString(),
        emailDomain: domain || undefined,
      });
    } catch (e: any) {
      setResult({
        ok: false,
        status: 0,
        error: e?.message || "Request failed",
        sentAt: new Date().toLocaleString(),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Debug</div>
          <div className="h2">Auth email probe</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Dev-only OTP sender for latency tracking.
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
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Next path</span>
          <input
            className="input"
            value={nextPath}
            onChange={(e) => setNextPath(e.target.value)}
            placeholder="/inbox"
          />
        </label>

        <button type="button" className="btnPrimary" onClick={send} disabled={sending}>
          {sending ? "Sending..." : "Send OTP"}
        </button>

        {result ? (
          <div className="soft">
            <div className="muted">
              Status: {result.status} {result.ok ? "OK" : "Error"}
            </div>
            {result.requestId ? <div>Request ID: {result.requestId}</div> : null}
            {result.emailDomain ? <div>Email domain: {result.emailDomain}</div> : null}
            {result.error ? <div className="err">❌ {result.error}</div> : null}
            <div className="muted">Client timestamp: {result.sentAt}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
