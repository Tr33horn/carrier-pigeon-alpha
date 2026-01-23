import { sanitizeNext } from "@/app/lib/authRedirect";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import StartSignIn from "./_components/StartSignIn";
import styles from "./start.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function StartPage({ searchParams }: PageProps) {
  // ✅ Next 16: searchParams may be a Promise
  const sp = (await searchParams) ?? {};

  const supabase = await createSupabaseServerReadClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  const nextRaw = typeof sp.next === "string" ? sp.next : undefined;
  const nextPath = sanitizeNext(nextRaw) || "/inbox";

  const errorRaw = typeof sp.error === "string" ? sp.error : undefined;
  const reasonRaw = typeof sp.reason === "string" ? sp.reason : undefined;

  return (
    <main className={`pageBg ${styles.startPage}`}>
      <section className={styles.startStack}>
        {/* Optional: show why you landed here */}
        {!user && errorRaw ? (
          <div className={`card ${styles.startCard}`}>
            <div className="err" style={{ whiteSpace: "pre-wrap" }}>
              ❌ {errorRaw}
              {reasonRaw ? `\n${decodeURIComponent(reasonRaw)}` : ""}
            </div>
          </div>
        ) : null}

        {user ? (
          <div className={`card ${styles.startCard}`}>
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">FLOK</div>
                <div className="h2">You&apos;re signed in</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Continue where you were going.
                </div>
              </div>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              <a className="btnPrimary" href={nextPath} style={{ textAlign: "center" }}>
                Continue
              </a>
            </div>
          </div>
        ) : (
          <StartSignIn />
        )}
      </section>

      <div className={styles.backHomeWrap}>
        <a className="btnGhost" href="/">
          Back to home
        </a>
      </div>
    </main>
  );
}
