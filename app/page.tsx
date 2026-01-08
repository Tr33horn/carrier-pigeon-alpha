"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase connection...");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const res = await fetch("/api/health/supabase", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setOk(false);
          setStatus("Supabase error: " + (data?.error ?? "Unknown error"));
          return;
        }

        setOk(true);
        setStatus("Supabase connected successfully.");
      } catch (e: any) {
        if (!alive) return;
        setOk(false);
        setStatus("Supabase error: " + (e?.message ?? "Network error"));
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="pageBg">
      <div className="wrap">
        <div className="homeCenter">
          {/* Page-only tweaks */}
          <style>{`
            /* Desktop/tablet: do NOT mess with layout widths */
            .homeTitle {
              margin-top: 8px;
              text-wrap: balance;
              margin-left: auto;
              margin-right: auto;
              max-width: none; /* keep desktop as-is */
            }

            /* Hero card: same width behavior as other cards */
            .homeHero {
              width: 100%;
            }

            .homeHeroInner {
              padding: 18px;
            }

            .homeHeroImg {
              width: 100%;
              height: auto;
              display: block;
              object-fit: contain; /* logo stays crisp */
              max-height: 420px;   /* desktop comfort */
            }

            /* Mobile-only changes */
            @media (max-width: 520px) {
              .homeTitle {
                max-width: 18ch;  /* forces 2 lines */
                line-height: 1.05;
              }

              .homeHeroInner {
                padding: 10px;    /* tighter padding around image */
              }

              .homeHeroImg {
                max-height: 240px; /* stops hero from hogging screen */
              }

              /* Make hero feel less like a huge framed painting (mobile only) */
              .homeHero {
                border-radius: 18px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.06);
              }
            }
          `}</style>

          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div className="kicker">FLOK</div>

            <h1 className="h1 homeTitle">Made to wait. Meant to matter.</h1>

            <p className="muted" style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
              Brought to you by Polaroid &amp; Maruchan Instant noodles
            </p>
          </div>

          {/* Hero (now same width as other cards) */}
          <div className="card homeHero" aria-hidden="true">
            <div className="homeHeroInner">
              <img src="/hero/og.png" alt="" className="homeHeroImg" />
            </div>
          </div>

          {/* Actions */}
          <div className="card" style={{ width: "100%" }}>
            <div className="stack" style={{ gap: 10 }}>
              <Link href="/new" className="btnPrimary" style={{ textAlign: "center" }}>
                Write a Letter
              </Link>

              <Link href="/dashboard" className="btnGhost" style={{ textAlign: "center" }}>
                Go to Dashboard
              </Link>

              <Link href="/about" className="btnGhost" style={{ textAlign: "center" }}>
                About FLOK
              </Link>
            </div>

            {/* Status */}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
              <div className="metaPill faint">
                <span
                  className="ico"
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: ok === null ? "rgba(0,0,0,0.35)" : ok ? "var(--ok-green)" : "#d92d20",
                  }}
                />
                <span style={{ fontWeight: 900 }}>{ok === null ? "Checking" : ok ? "Connected" : "Issue"}</span>
                <span style={{ opacity: 0.75, fontWeight: 900 }}>{status}</span>
              </div>
            </div>
          </div>

          <p className="muted" style={{ textAlign: "center" }}>
            Slow mail, fast feelings.
          </p>
        </div>
      </div>
    </main>
  );
}