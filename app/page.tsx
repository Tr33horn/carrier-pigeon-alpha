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
            /* Make the headline behave like a “2-line hero” on phones */
            .homeTitle {
              margin-top: 8px;
              text-wrap: balance;
              max-width: 26ch; /* desktop-ish */
              margin-left: auto;
              margin-right: auto;
            }

            /* Hero card sizing */
            .homeHero {
              width: 100%;
              max-width: 520px;
              margin-left: auto;
              margin-right: auto;
            }

            .homeHeroInner {
              padding: 18px;
            }

            .homeHeroImg {
              width: 100%;
              height: auto;
              display: block;
              object-fit: contain; /* logo stays crisp, no weird cropping */
              max-height: 360px;
            }

            @media (max-width: 520px) {
              .homeTitle {
                max-width: 18ch;  /* forces “Made to wait.” / “Meant to matter.” */
                line-height: 1.05;
              }

              .homeHeroInner {
                padding: 10px; /* tighter padding around the image */
              }

              .homeHeroImg {
                max-height: 240px; /* stops it from eating the screen */
              }
            }
          `}</style>

          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div className="kicker">FLOK</div>

            <h1 className="h1 homeTitle">
              Made to wait. Meant to matter.
            </h1>

            <p className="muted" style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
              Brought to you by Polaroid &amp; Maruchan Instant noodles
            </p>
          </div>

          {/* Hero */}
          <div className="card homeHero" aria-hidden="true">
            <div className="homeHeroInner">
              <img
                src="/hero/og.png"
                alt=""
                className="homeHeroImg"
              />
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
                    background:
                      ok === null ? "rgba(0,0,0,0.35)" : ok ? "var(--ok-green)" : "#d92d20",
                  }}
                />
                <span style={{ fontWeight: 900 }}>
                  {ok === null ? "Checking" : ok ? "Connected" : "Issue"}
                </span>
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