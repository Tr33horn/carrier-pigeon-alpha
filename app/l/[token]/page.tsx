import OtpForm from "./_components/OtpForm";
import { headers } from "next/headers";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import CleanAuthHash from "./_components/CleanAuthHash";
import MapSectionClient from "./_components/MapSectionClient";
import TimelineSection from "./_components/TimelineSection";
import StatusAutoRefresh from "./_components/StatusAutoRefresh";
import { birdDisplayLabel, normalizeBird } from "@/app/lib/birds";
import { getEnvelopeTintColor, normalizeEnvelopeTint } from "@/app/lib/envelopeTints";
import { getSealImgSrc } from "@/app/lib/seals";
import styles from "./status.module.css";
import AppHeader from "@/app/_components/AppHeader";

function formatLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

function InvalidLinkCard({ openedMessage }: { openedMessage?: boolean }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="err">
        ❌ This link is {openedMessage ? "invalid, expired, or already used" : "invalid or expired"}.
      </div>
    </div>
  );
}

type StatusApi = {
  archived: boolean;
  archived_at: string | null;
  canceled: boolean;
  canceled_at: string | null;
  server_now_iso?: string | null;
  letter: {
    id: string;
    public_token: string;
    from_name: string | null;
    to_name: string | null;
    subject: string | null;
    origin_name: string | null;
    origin_lat: number;
    origin_lon: number;
    dest_name: string | null;
    dest_lat: number;
    dest_lon: number;
    sent_at: string | null;
    opened_at?: string | null;
    eta_at: string | null;
    eta_at_adjusted?: string | null;
    eta_utc_text?: string | null;
    bird?: string | null;
    bird_type?: string | null;
    seal_id?: string | null;
    envelope_tint?: string | null;
    body?: string | null;
    distance_km?: number | null;
    speed_kmh?: number | null;
  };
  checkpoints: any[];
  delivered: boolean;
  current_over_text: string;
  flight: {
    progress: number;
    sleeping: boolean;
    sleep_until_iso?: string | null;
    sleep_local_text?: string | null;
    tooltip_text: string;
    marker_mode: "flying" | "sleeping" | "delivered" | "canceled";
    current_speed_kmh?: number | null;
  };
  items: {
    badges: Array<{
      id: string;
      code: string;
      title: string;
      subtitle?: string | null;
      iconSrc?: string | null;
      rarity?: string | null;
      earned_at?: string | null;
    }>;
  };
};

async function getRequestOrigin() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") || "https";
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  if (host) return `${proto}://${host}`;
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return env.endsWith("/") ? env.slice(0, -1) : env;
}

export default async function LetterTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerReadClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const origin = await getRequestOrigin();
  const res = await fetch(`${origin}/api/letters/${token}`, { cache: "no-store" });
  if (!res.ok) {
    return (
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <h1 className="h1">Flight status</h1>
          <InvalidLinkCard />
        </div>
      </main>
    );
  }

  const data = (await res.json()) as StatusApi;
  const letter = data.letter;
  const flight = data.flight;

  const etaIso = letter.eta_at_adjusted ?? letter.eta_at;
  const etaMs = etaIso ? new Date(etaIso).getTime() : null;
  const arrived = data.delivered || !!(etaMs && Date.now() >= etaMs);

  const birdType = normalizeBird(letter.bird_type ?? letter.bird ?? "pigeon");
  const birdLabel = birdDisplayLabel(birdType);
  const sealImg = getSealImgSrc(letter.seal_id) || "/waxseal.png";
  const envTint = getEnvelopeTintColor(normalizeEnvelopeTint(letter.envelope_tint));
  const isOpened = !!letter.opened_at;
  let isSender = false;

  if (user) {
    const { data: roleLetter, error: roleErr } = await supabase
      .from("letters")
      .select("sender_user_id")
      .eq("public_token", token)
      .maybeSingle();
    if (!roleErr && roleLetter?.sender_user_id === user.id) isSender = true;
  }

  // Logged out: status + OTP
  if (!user) {
    return (
      <>
        <AppHeader />
        <main className="pageBg">
          <CleanAuthHash />
          <StatusAutoRefresh enabled={!data.delivered && !data.canceled} />
          <div className="wrap">
          <div className={styles.statusHero}>
            <div className="card">
              <div className="kicker">Flight status</div>
              <div className="h1">
                {letter.origin_name ?? "Unknown origin"} → {letter.dest_name ?? "Unknown destination"}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Bird: <strong>{birdLabel}</strong>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {data.delivered ? (
                  <>
                    <div className="metaPill faint">
                      Sent: <strong>{letter.sent_at ? formatLocal(letter.sent_at) : "Unknown"}</strong>
                    </div>
                    <div className="metaPill faint">
                      Delivered: <strong>{etaIso ? formatLocal(etaIso) : "Unknown"}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metaPill faint">
                      ETA: <strong>{etaIso ? formatLocal(etaIso) : "ETA unknown"}</strong>
                    </div>
                    {letter.eta_utc_text ? <div className="metaPill faint">{letter.eta_utc_text}</div> : null}
                    <div className="metaPill faint">
                      Progress: <strong>{Math.floor((flight.progress ?? 0) * 100)}%</strong>
                    </div>
                    {flight.sleeping && flight.sleep_local_text ? (
                      <div className="metaPill faint">Resting · {flight.sleep_local_text}</div>
                    ) : null}
                  </>
                )}
                {isOpened ? (
                  <div className="metaPill faint">Opened: {formatLocal(letter.opened_at)}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className={`${styles.statusGrid} ${data.delivered ? styles.deliveredStack : styles.incomingWide}`}
          >
            <div className={`${styles.statusCol} ${styles.gridLetter}`}>
              <div className={`card letterCard ${styles.statusLetterCard}`}>
                <div className="cardHead">
                  <div>
                    <div className="kicker">Letter</div>
                    <div className="h2">
                      {letter.from_name ? `From ${letter.from_name}` : "From someone"}
                    </div>
                    {letter.subject ? <div className="muted">{letter.subject}</div> : null}
                  </div>
                </div>

                <div className="soft envelope" style={{ marginTop: 14, ["--env-tint" as any]: envTint }}>
                  <div className="sealCard">
                    <div className="sealRow">
                      <button type="button" className="waxBtn" aria-label="Wax seal preview" disabled>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sealImg} alt="" className="waxImg" />
                      </button>

                      <div>
                        <div className="sealTitle">{isOpened ? "Opened letter" : "Sealed letter"}</div>
                        <div className="sealSub">{isOpened ? "Opened by recipient." : "Sign in to open once delivered."}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.statusCol} ${styles.gridMap}`}>
              <MapSectionClient
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={flight.progress ?? 0}
                progressPctFloor={Math.floor((flight.progress ?? 0) * 100)}
                tooltipText={flight.tooltip_text}
                markerMode={flight.marker_mode}
                showLive={!data.delivered && !data.canceled}
                sentAtISO={letter.sent_at ?? undefined}
                etaAtISO={etaIso ?? undefined}
                currentlyOver={data.current_over_text}
                cardClassName={styles.statusMapCard}
              />
            </div>

            <div className={`${styles.statusFull} ${styles.gridTimeline}`}>
              <div className="card">
                <div className="kicker">Flight log</div>
                <TimelineSection
                  letter={{ sent_at: letter.sent_at ?? "", origin_name: letter.origin_name }}
                  checkpoints={data.checkpoints ?? []}
                  delivered={data.delivered}
                  canceled={data.canceled}
                  sleeping={flight.sleeping}
                  effectiveEtaISO={etaIso ?? ""}
                  birdName={birdLabel}
                  nowISO={data.server_now_iso ?? undefined}
                />
              </div>
            </div>

            <div className={`${styles.statusFull} ${styles.gridBadges}`}>
              <div className="card">
                <div className="kicker">Badges</div>
                <div className="h2">Earned on this flight</div>
                {data.items?.badges?.length ? (
                  <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                    {data.items.badges.map((b) => (
                      <div key={b.id} className="soft" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {b.iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.iconSrc} alt={b.title} style={{ width: 28, height: 28 }} />
                        ) : null}
                        <div>
                          <div style={{ fontWeight: 800 }}>{b.title}</div>
                          {b.subtitle ? <div className="muted">{b.subtitle}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>
                    No badges yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <OtpForm />
          </div>
        </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="pageBg">
        <CleanAuthHash />
        <StatusAutoRefresh enabled={!data.delivered && !data.canceled} />
        <div className="wrap">
        <div className={styles.statusHero}>
          <div className="card">
            <div className="kicker">Flight status</div>
            <div className="h1">
              {letter.origin_name ?? "Unknown origin"} → {letter.dest_name ?? "Unknown destination"}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Bird: <strong>{birdLabel}</strong>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {data.delivered ? (
                <>
                  <div className="metaPill faint">
                    Sent: <strong>{letter.sent_at ? formatLocal(letter.sent_at) : "Unknown"}</strong>
                  </div>
                  <div className="metaPill faint">
                    Delivered: <strong>{etaIso ? formatLocal(etaIso) : "Unknown"}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="metaPill faint">
                    ETA: <strong>{etaIso ? formatLocal(etaIso) : "ETA unknown"}</strong>
                  </div>
                  {letter.eta_utc_text ? <div className="metaPill faint">{letter.eta_utc_text}</div> : null}
                  <div className="metaPill faint">
                    Progress: <strong>{Math.floor((flight.progress ?? 0) * 100)}%</strong>
                  </div>
                  {flight.sleeping && flight.sleep_local_text ? (
                    <div className="metaPill faint">Resting · {flight.sleep_local_text}</div>
                  ) : null}
                </>
              )}
              {isOpened ? (
                <div className="metaPill faint">Opened: {formatLocal(letter.opened_at)}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={`${styles.statusGrid} ${data.delivered ? styles.deliveredStack : styles.incomingWide}`}
        >
          {!isOpened ? (
            <div className={`${styles.statusCol} ${styles.gridLetter}`}>
              <div className={`card letterCard ${styles.statusLetterCard}`}>
                <div className="cardHead">
                  <div>
                    <div className="kicker">Letter</div>
                    <div className="h2">
                      {letter.from_name ? `From ${letter.from_name}` : "From someone"}
                    </div>
                    {letter.subject ? <div className="muted">{letter.subject}</div> : null}
                  </div>
                </div>

                <div className="soft envelope" style={{ marginTop: 14, ["--env-tint" as any]: envTint }}>
                <div className="sealCard">
                  <div className="sealRow">
                    {arrived && !isOpened && !isSender ? (
                      <a
                        href={`/l/${token}/open?auto=1`}
                        className="waxBtn"
                        aria-label="Open letter"
                        title="Open letter"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sealImg} alt="" className="waxImg" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="waxBtn"
                        aria-label="Wax seal preview"
                        title={isSender && arrived ? "Only the recipient can open this letter." : "Wax seal preview"}
                        disabled
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sealImg} alt="" className="waxImg" />
                      </button>
                    )}

                    <div>
                      <div className="sealTitle">{isOpened ? "Opened letter" : "Sealed letter"}</div>
                      <div className="sealSub">
                        {isOpened
                          ? "Opened by recipient."
                          : arrived
                          ? isSender
                            ? "Delivered to recipient."
                            : "Ready to open."
                          : "Sealed until delivery."}
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {isOpened ? (
                    <div className="muted">Opened by recipient.</div>
                  ) : arrived ? (
                    <div className="muted">{isSender ? "Delivered to recipient." : "Tap the seal to open."}</div>
                  ) : (
                    <div className="muted">
                      Arrives at {etaIso ? formatLocal(etaIso) : "an unknown time"}. You can open it once it
                      lands.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {isOpened && letter.body ? (
            <div className={`${styles.statusFull} ${styles.gridOpen}`}>
              <div className="card">
                <div className="kicker">
                  OPENED LETTER FROM{" "}
                  {letter.from_name ? letter.from_name.toUpperCase() : "SOMEONE"}
                </div>
                <div className="h2">Message</div>
                <div className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                  {letter.body}
                </div>
              </div>
            </div>
          ) : null}

          <div className={`${styles.statusCol} ${styles.gridMap}`}>
            {isOpened ? (
              <details className="card">
                <summary className={`cardHead ${styles.collapseSummary}`}>
                  <div className="kicker">Map</div>
                  <div className="muted">Collapsed</div>
                </summary>
                <div className={styles.statusMapCard} style={{ marginTop: 10 }}>
                  <MapSectionClient
                    origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                    dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                    progress={flight.progress ?? 0}
                    progressPctFloor={Math.floor((flight.progress ?? 0) * 100)}
                    tooltipText={flight.tooltip_text}
                    markerMode={flight.marker_mode}
                    showLive={!data.delivered && !data.canceled}
                    sentAtISO={letter.sent_at ?? undefined}
                    etaAtISO={etaIso ?? undefined}
                    currentlyOver={data.current_over_text}
                    wrapCard={false}
                  />
                </div>
              </details>
            ) : (
              <MapSectionClient
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={flight.progress ?? 0}
                progressPctFloor={Math.floor((flight.progress ?? 0) * 100)}
                tooltipText={flight.tooltip_text}
                markerMode={flight.marker_mode}
                showLive={!data.delivered && !data.canceled}
                sentAtISO={letter.sent_at ?? undefined}
                etaAtISO={etaIso ?? undefined}
                currentlyOver={data.current_over_text}
                cardClassName={styles.statusMapCard}
              />
            )}
          </div>

          <div className={`${styles.statusFull} ${styles.gridTimeline}`}>
            {isOpened ? (
              <details className="card">
                <summary className={`cardHead ${styles.collapseSummary}`}>
                  <div className="kicker">Flight log</div>
                  <div className="muted">Collapsed</div>
                </summary>
                <div style={{ marginTop: 10 }}>
                  <TimelineSection
                    letter={{ sent_at: letter.sent_at ?? "", origin_name: letter.origin_name }}
                    checkpoints={data.checkpoints ?? []}
                    delivered={data.delivered}
                    canceled={data.canceled}
                    sleeping={flight.sleeping}
                    effectiveEtaISO={etaIso ?? ""}
                    birdName={birdLabel}
                    nowISO={data.server_now_iso ?? undefined}
                  />
                </div>
              </details>
            ) : (
              <div className="card">
                <div className="kicker">Flight log</div>
                <TimelineSection
                  letter={{ sent_at: letter.sent_at ?? "", origin_name: letter.origin_name }}
                  checkpoints={data.checkpoints ?? []}
                  delivered={data.delivered}
                  canceled={data.canceled}
                  sleeping={flight.sleeping}
                  effectiveEtaISO={etaIso ?? ""}
                  birdName={birdLabel}
                  nowISO={data.server_now_iso ?? undefined}
                />
              </div>
            )}
          </div>

          <div className={`${styles.statusFull} ${styles.gridBadges}`}>
            <div className="card">
              <div className="kicker">Badges</div>
              <div className="h2">Earned on this flight</div>
              {data.items?.badges?.length ? (
                <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                  {data.items.badges.map((b) => (
                    <div key={b.id} className="soft" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {b.iconSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.iconSrc} alt={b.title} style={{ width: 28, height: 28 }} />
                      ) : null}
                      <div>
                        <div style={{ fontWeight: 800 }}>{b.title}</div>
                        {b.subtitle ? <div className="muted">{b.subtitle}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 8 }}>
                  No badges yet.
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </main>
    </>
  );
}
