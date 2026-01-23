import { notFound } from "next/navigation";
import AuthOtpDebugClient from "./_components/AuthOtpDebugClient";

export default function AuthEmailDebugPage() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "dev") {
    notFound();
  }

  return (
    <main className="pageBg">
      <div className="wrap">
        <div className="stack" style={{ gap: 14 }}>
          <AuthOtpDebugClient />

          <div className="card" style={{ maxWidth: 640 }}>
            <div className="cardHead">
              <div>
                <div className="kicker">Checklist</div>
                <div className="h2">Delivery sanity checks</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="muted">
                If server logs show ok quickly but email is delayed: configure Supabase Auth SMTP (Resend).
              </div>
              <div className="muted">Check spam/quarantine and Promotions tabs.</div>
              <div className="muted">
                If callback errors: verify redirect URL allowlist in Supabase Auth settings.
              </div>
            </div>
          </div>

          <div className="card" style={{ maxWidth: 640 }}>
            <div className="cardHead">
              <div>
                <div className="kicker">Vercel env</div>
                <div className="h2">Required variables</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <div className="muted">NEXT_PUBLIC_SUPABASE_URL</div>
              <div className="muted">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
              <div className="muted">SUPABASE_SERVICE_ROLE_KEY</div>
              <div className="muted">RESEND_API_KEY</div>
              <div className="muted">APP_URL or NEXT_PUBLIC_APP_URL</div>
              <div className="muted">NEXT_PUBLIC_APP_ENV</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
