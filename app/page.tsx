"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase connection...");
  const [ok, setOk] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

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

  useEffect(() => {
    let alive = true;
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setSignedIn(!!data?.signedIn);
      } catch {
        if (!alive) return;
        setSignedIn(false);
      }
    }
    loadSession();
    return () => {
      alive = false;
    };
  }, []);

  const inboxHref = signedIn ? "/inbox" : "/start";
  const sentHref = signedIn ? "/sent" : "/start";

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
              max-width: none;
            }

            .homeHero {
              width: 100%;
            }

            .homeHeroInner {
              padding: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .homeHeroImg {
              width: 100%;
              height: auto;
              display: block;
              object-fit: contain;
              max-height: 420px;
            }

            /* Mobile-only changes */
            @media (max-width: 520px) {
              /* tighten vertical rhythm above hero */
              .homeHeaderBlock {
                margin-bottom: 6px !important;
              }

              .homeTitle {
                max-width: 18ch;
                line-height: 1.05;
                margin-top: 6px;
              }

              /* this is the big one: reduce spacing around the hero card itself */
              .homeHero {
                margin-top: 10px !important;
                margin-bottom: 10px !important;
                border-radius: 18px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.06);
              }

              /* real tight padding inside the frame */
              .homeHeroInner {
                padding: 6px;
              }

              /* force the image to stop being a full-page billboard */
              .homeHeroImg {
                max-height: 170px;
              }

              /* tighten space before the actions card */
              .homeActionsCard {
                margin-top: 10px !important;
              }
            }
          `}</style>

          {/* Header */}
          <div className="homeHeaderBlock" style={{ textAlign: "center" }}>
            <div className="kicker">FLOK</div>

            <h1 className="h1 homeTitle">Made to wait. Meant to matter.</h1>

            <p className="muted" style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
              Brought to you by Polaroid &amp; Maruchan Instant noodles
            </p>
          </div>

          {/* Hero */}
          <div className="card homeHero" aria-hidden="true" style={{ marginTop: 14 }}>
            <div className="homeHeroInner">
              <img src="/hero/og.png" alt="" className="homeHeroImg" />
            </div>
          </div>

          {/* Actions */}
          <div className="card homeActionsCard" style={{ width: "100%", marginTop: 14 }}>
            <div className="stack" style={{ gap: 10 }}>
              <Link href="/new" className="btnPrimary" style={{ textAlign: "center" }}>
                Write a Letter
              </Link>

              <Link href="/dashboard" className="btnGhost" style={{ textAlign: "center" }}>
                Go to Dashboard
              </Link>

              <Link href={inboxHref} className="btnGhost" style={{ textAlign: "center" }}>
                Inbox
              </Link>

              <Link href={sentHref} className="btnGhost" style={{ textAlign: "center" }}>
                Sent
              </Link>

              {signedIn === false ? (
                <div className="muted" style={{ textAlign: "center" }}>
                  Sign in to collect your letters.
                </div>
              ) : null}

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
