import Link from "next/link";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

// Manual test: mint, unseal as recipient, refresh /inbox should show it.
type Row = {
  id: string;
  bird_type: string | null;
  dest_region_id: string | null;
  eta_at: string | null;
  created_at: string;
  opened_at: string | null;
  message: string | null;
};

export default async function InboxPage() {
  const supabase = await createSupabaseServerReadClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <main className="pageBg">
        <div className="wrap">
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="kicker">FLOK</div>
            <div className="h2">Collect your letters</div>
            <p className="muted">Sign in to view your inbox and sent letters.</p>

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

  const { data, error } = await supabase.rpc("get_inbox_letters");

  if (error) {
    return (
      <main className="pageBg">
        <div className="wrap">
          <h1 className="h1">Inbox</h1>
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="err">❌ Could not load inbox.</div>
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
        <h1 className="h1">Inbox</h1>

        {rows.length === 0 ? (
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="muted">No collected letters yet.</div>
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
                <div className="kicker">Collected letter</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{l.bird_type ?? "bird"}</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Destination: {l.dest_region_id ?? "somewhere over the map"}
                </div>
                <div className="muted">ETA: {l.eta_at ?? "—"}</div>

                <div className="soft" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                  {l.message ?? ""}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <Link className="btnGhost" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
