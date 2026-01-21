"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

type Step = "idle" | "sent" | "verifying" | "error";

type Props = {
  token: string;
};

function looksLikeEmail(value: string) {
  return value.includes("@");
}

function normalizeInput(value: string) {
  return value.trim();
}

export default function OtpForm({ token }: Props) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isEmail = useMemo(() => looksLikeEmail(contact), [contact]);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const sendOtp = async () => {
    setSending(true);
    setError(null);

    const value = normalizeInput(contact);
    if (!value) {
      setError("Enter an email or phone number.");
      setSending(false);
      return;
    }

    try {
      if (isEmail) {
        // Send an email link that returns through our callback route,
        // which exchanges the code and sets the session cookie.
        // Supabase Auth Redirect URLs must include this URL for OTP to succeed.
        const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(`/l/${token}`)}`;

        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: value,
          options: { emailRedirectTo: redirectTo },
        });

        if (otpErr) throw otpErr;
        setStep("sent");
        return;
      }

      // SMS flow: user types a code on this page
      const { error: otpErr } = await supabase.auth.signInWithOtp({ phone: value });
      if (otpErr) throw otpErr;
      setStep("verifying");
    } catch (e: any) {
      setError(e?.message || "Could not send OTP. Try again.");
      setStep("error");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    setSending(true);
    setError(null);

    const value = normalizeInput(contact);
    const tokenValue = normalizeInput(code);
    if (!value || !tokenValue) {
      setError("Enter the code from your phone.");
      setSending(false);
      return;
    }

    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        phone: value,
        token: tokenValue,
        type: "sms",
      });
      if (verifyErr) throw verifyErr;

      // Pull the new session into the server-rendered page state
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Code did not work. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Open letter</div>
          <div className="h2">Verify to unlock</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label className="muted" htmlFor="otp-contact">
          Email or phone
        </label>
        <input
          id="otp-contact"
          className="input"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com or +1 555 555 5555"
          autoComplete="email"
        />

        {!isEmail && step === "verifying" ? (
          <>
            <label className="muted" htmlFor="otp-code">
              Code
            </label>
            <input
              id="otp-code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
            />
          </>
        ) : null}

        {error ? <div className="err">❌ {error}</div> : null}

        {step === "sent" && isEmail ? (
          <div className="muted">Check your email for a sign-in link.</div>
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {step === "verifying" && !isEmail ? (
            <button type="button" className="btnPrimary" onClick={verifyOtp} disabled={sending}>
              Verify code
            </button>
          ) : (
            <button type="button" className="btnPrimary" onClick={sendOtp} disabled={sending}>
              Send OTP
            </button>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            Secure one-time access.
          </span>
        </div>
      </div>
    </div>
  );
}
