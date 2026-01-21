import Link from "next/link";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

// Manual test: mint as sender, refresh /sent should show it.
type Row = {
  id: string;
  bird_type: string | null;
  dest_region_id: string | null;
  eta_at: string | null;
  created_at: string;
  message: string | null;
  to_name: string | null;
  to_email: string | null;
};

export default async function SentPage() {
  const supabase = await createSupabaseServerReadClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <main className="pageBg">
        <div className="wrap">
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="kicker">FLOK</div>
            <div className="h2">Sent letters</div>
            <p className="muted">Sign in to view your sent letters.</p>

            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <Link className="btnPrimary" href="/new" style={{ textAlign: "center" }}>
                Write a letter
              </Link>
              <Link className="btnGhost" href="/" style={{ textAlign: "center" }}>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("get_sent_letters");

  if (error) {
    return (
      <main className="pageBg">
        <div className="wrap">
          <h1 className="h1">Sent</h1>
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="err">❌ Could not load sent.</div>
            {process.env.NEXT_PUBLIC_APP_ENV === "dev" ? (
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.7 }}>
                {JSON.stringify({ message: error.message, details: error }, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const rows = (data ?? []) as Row[];

  return (
    <main className="pageBg">
      <div className="wrap">
        <h1 className="h1">Sent</h1>

        {rows.length === 0 ? (
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="muted">No sent letters yet.</div>
            <div style={{ marginTop: 10 }}>
              <Link className="btnGhost" href="/new">
                Write one
              </Link>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12, maxWidth: 760 }}>
            {rows.map((l) => (
              <div key={l.id} className="card">
                <div className="kicker">Sent letter</div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>
                    {l.to_name ? `To: ${l.to_name}` : "To: someone"}
                    {l.to_email ? <span className="muted"> ({l.to_email})</span> : null}
                  </div>
                  <div className="muted" style={{ fontWeight: 800 }}>
                    {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 8 }}>
                  Bird: {l.bird_type ?? "bird"}
                </div>
                <div className="muted">Destination: {l.dest_region_id ?? "somewhere over the map"}</div>
                <div className="muted">ETA: {l.eta_at ?? "—"}</div>

                {l.message ? (
                  <div className="soft" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                    {l.message}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btnGhost" href="/inbox">
            Inbox
          </Link>
          <Link className="btnGhost" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
