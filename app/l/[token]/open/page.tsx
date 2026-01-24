import { redirect } from "next/navigation";

import OtpForm from "../_components/OtpForm";
import UnsealButton from "../_components/UnsealButton";
import CleanAuthHash from "../_components/CleanAuthHash";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import { US_REGIONS } from "@/app/lib/geo/usRegions";
import AppHeader from "@/app/_components/AppHeader";
import { getSealImgSrc } from "@/app/lib/seals";
import { getEnvelopeTintColor, normalizeEnvelopeTint } from "@/app/lib/envelopeTints";
import styles from "../status.module.css";

function formatLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

const REGION_LABELS = new Map<string, string>(US_REGIONS.map((r) => [r.id, r.label]));

function regionLabelFor(id?: string | null) {
  if (!id) return "somewhere over the map";
  return REGION_LABELS.get(id) || id;
}

type StatusRow = {
  bird_type: string | null;
  from_name: string | null;
  subject: string | null;
  seal_id: string | null;
  envelope_tint: string | null;
  dest_region_id: string | null;
  eta_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  canceled_at: string | null;
};

type LetterRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string | null;
  bird_type: string;
  dest_region_id: string;
  eta_at: string;
  message: string;
  opened_at: string | null;
};

function StatusCard({ status }: { status: StatusRow }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Flight status</div>
          <div className="h2">In transit</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            Bird
          </div>
          <div style={{ fontWeight: 700 }}>{status.bird_type ?? "bird"}</div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            Destination
          </div>
          <div style={{ fontWeight: 700 }}>{regionLabelFor(status.dest_region_id)}</div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            ETA
          </div>
          <div style={{ fontWeight: 700 }}>
            {status.eta_at ? formatLocal(status.eta_at) : "ETA unknown"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptCard({ bird_type, dest_region_id, eta_at, opened_at }: StatusRow) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="kicker">Delivery receipt</div>
        </div>
      </div>

      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="metaPill">
          Delivered: <strong>{eta_at ? formatLocal(eta_at) : "Unknown"}</strong>
        </div>
        <div className="metaPill">
          Opened: <strong>{opened_at ? formatLocal(opened_at) : "Unknown"}</strong>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        Bird: <strong>{bird_type ?? "bird"}</strong> • Destination:{" "}
        <strong>{regionLabelFor(dest_region_id)}</strong>
      </div>
    </div>
  );
}

function LetterView({ letter, title }: { letter: LetterRow; title: string }) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="kicker">Opened letter</div>
          <div className="h2">{title}</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="soft" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {letter.message}
        </div>

        <button type="button" className="btnPrimary" disabled>
          Claim bundle (soon)
        </button>
      </div>
    </div>
  );
}

function InvalidLinkCard() {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="err">❌ This link is invalid or expired.</div>
    </div>
  );
}

export default async function LetterOpenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerReadClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const { data: statusData } = await supabase.rpc("status_letter_by_token", { p_token: token });
  const status = (Array.isArray(statusData) ? statusData[0] : statusData) as StatusRow | null | undefined;

  if (!status) {
    return (
      <>
        <AppHeader />
        <main className="pageBg">
          <CleanAuthHash />
          <div className="wrap">
            <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
              <h1 className="h1">Open letter</h1>
              <InvalidLinkCard />
            </div>
          </div>
        </main>
      </>
    );
  }

  const etaMs = status.eta_at ? new Date(status.eta_at).getTime() : null;
  const arrived = !!(etaMs && Date.now() >= etaMs);

  if (!arrived) {
    redirect(`/l/${token}`);
  }

  const sealImg = getSealImgSrc(status?.seal_id) || "/waxseal.png";
  const envTint = getEnvelopeTintColor(normalizeEnvelopeTint(status?.envelope_tint));

  if (!user) {
    return (
      <>
        <AppHeader />
        <main className="pageBg">
          <CleanAuthHash />
          <div className="wrap">
            <div>
              <div style={{ textAlign: "center" }}>
                <h1 className="h1">Open letter</h1>
              </div>
              <StatusCard status={status} />
              <div className={`card letterCard ${styles.statusLetterCard}`} style={{ marginTop: 16 }}>
                <div className="cardHead" style={{ textAlign: "center", justifyContent: "center" }}>
                  <div>
                    <div className="kicker">Letter</div>
                    <div className="h2">{status?.from_name ? `From ${status.from_name}` : "From someone"}</div>
                    {status?.subject ? <div className="muted">{status.subject}</div> : null}
                  </div>
                </div>

                <div className="soft envelope" style={{ marginTop: 14, ["--env-tint" as any]: envTint }}>
                  <div className="sealCard">
                    <div className="sealRow">
                      <button type="button" className="waxBtn" aria-label="Sealed letter" disabled>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sealImg} alt="" className="waxImg" />
                      </button>

                      <div>
                        <div className="sealTitle">Sealed letter</div>
                        <div className="sealSub">Sign in to open.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <OtpForm />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const { data: openedData } = await supabase.rpc("read_opened_letter_by_public_token", { p_token: token });
  const openedRow = (Array.isArray(openedData) ? openedData[0] : openedData) as LetterRow | null | undefined;
  const isOpened = !!openedRow?.id;

  return (
    <>
      <AppHeader />
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <div>
          <div style={{ textAlign: "center" }}>
            <h1 className="h1">{isOpened ? "Seal broken" : "Open letter"}</h1>
            {isOpened ? (
              <div
                className="muted"
                style={{
                  marginTop: 8,
                  maxWidth: 640,
                  marginLeft: "auto",
                  marginRight: "auto",
                  textAlign: "center",
                }}
              >
                The seal is broken. This letter is now yours to keep.
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <a className="link" href={`/l/${token}`}>
                  View flight status
                </a>
              </div>
            )}
          </div>

        {isOpened ? (
          <>
            <div>
              <ReceiptCard
                bird_type={openedRow!.bird_type}
                dest_region_id={openedRow!.dest_region_id}
                eta_at={openedRow!.eta_at}
                opened_at={openedRow!.opened_at}
                sent_at={null}
                canceled_at={null}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <LetterView
                letter={openedRow as LetterRow}
                title={status?.subject ? status.subject : "(No subject)"}
              />
            </div>
          </>
        ) : (
          <>
            <div className={`card letterCard ${styles.statusLetterCard}`} style={{ marginTop: 16 }}>
              <div className="cardHead" style={{ textAlign: "center", justifyContent: "center" }}>
                <div>
                  <div className="kicker">Letter</div>
                  <div className="h2">{status?.from_name ? `From ${status.from_name}` : "From someone"}</div>
                  {status?.subject ? <div className="muted">{status.subject}</div> : null}
                </div>
              </div>

              <div className="soft envelope" style={{ marginTop: 14, ["--env-tint" as any]: envTint }}>
                <div className="sealCard">
                  <div className="sealRow">
                    <UnsealButton
                      token={token}
                      variant="seal"
                      className="waxBtn"
                      buttonProps={{ "aria-label": "Unseal letter", title: "Unseal letter" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sealImg} alt="" className="waxImg" />
                    </UnsealButton>

                    <div>
                      <div className="sealTitle">Sealed letter</div>
                      <div className="sealSub">Ready to open.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
        </div>
        </div>
      </main>
    </>
  );
}
