import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

export default async function StartPage() {
  const supabase = await createSupabaseServerReadClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (user) redirect("/inbox");

  return (
    <main className="pageBg">
      <div className="wrap">
        <div className="card" style={{ maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          <div className="cardHead">
            <div>
              <div className="kicker">FLOK</div>
              <div className="h1">Collect your letters</div>
            </div>
          </div>

          <div className="stack" style={{ gap: 12 }}>
            <div className="muted">Sign in to view your inbox and sent letters.</div>

            <div className="stack" style={{ gap: 10 }}>
              <Link href="/new" className="btnPrimary" style={{ textAlign: "center" }}>
                Write a letter
              </Link>
              <Link href="/" className="btnGhost" style={{ textAlign: "center" }}>
                I have a letter link
              </Link>
            </div>

            <div className="muted">Open a letter link to sign in, or write a new letter.</div>
          </div>
        </div>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <Link href="/" className="btnGhost">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
