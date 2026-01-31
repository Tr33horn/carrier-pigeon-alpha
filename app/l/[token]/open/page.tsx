import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import OtpForm from "../_components/OtpForm";
import UnsealButton from "../_components/UnsealButton";
import ConfettiBurst from "../_components/ConfettiBurst";
import CleanAuthHash from "../_components/CleanAuthHash";
import { createSupabaseServerReadClient, createSupabaseServerActionClient } from "@/app/lib/supabase/server";
import { US_REGIONS } from "@/app/lib/geo/usRegions";
import AppHeader from "@/app/_components/AppHeader";
import { getSealImgSrc } from "@/app/lib/seals";
import { getEnvelopeTintColor, normalizeEnvelopeTint } from "@/app/lib/envelopeTints";
import { POSTCARD_TEMPLATES } from "@/app/lib/postcards";
import styles from "../status.module.css";
import LocalTime from "../_components/LocalTime";

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
  delivery_type?: "letter" | "postcard" | null;
  postcard_template_id?: string | null;
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
  delivery_type?: "letter" | "postcard" | null;
  postcard_template_id?: string | null;
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
            <LocalTime iso={status.eta_at} fallback="ETA unknown" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptCard({
  bird_type,
  dest_region_id,
  eta_at,
  opened_at,
}: {
  bird_type: string | null;
  dest_region_id: string | null;
  eta_at: string | null;
  opened_at: string | null;
}) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="kicker">Delivery receipt</div>
        </div>
      </div>

      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="metaPill">
          Delivered:{" "}
          <strong>
            <LocalTime iso={eta_at} fallback="Unknown" />
          </strong>
        </div>
        <div className="metaPill">
          Opened:{" "}
          <strong>
            <LocalTime iso={opened_at} fallback="Unknown" />
          </strong>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        Bird: <strong>{bird_type ?? "bird"}</strong> • Destination:{" "}
        <strong>{regionLabelFor(dest_region_id)}</strong>
      </div>
    </div>
  );
}

function LetterView({
  letter,
  title,
  isPostcard,
  postcardTemplate,
}: {
  letter: LetterRow;
  title: string;
  isPostcard: boolean;
  postcardTemplate: { name: string; preview: CSSProperties } | null;
}) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="kicker">{isPostcard ? "Postcard" : "Opened letter"}</div>
          <div className="h2">{isPostcard ? "Back side" : title}</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {isPostcard ? (
          <>
            <div className="postcardPreview" style={postcardTemplate?.preview}>
              <div className="postcardPreviewLabel">{postcardTemplate?.name ?? "Postcard"}</div>
              <div className="postcardBackHint">Front</div>
            </div>
            <div className="postcardBack">
              <div className="postcardBackTitle">Back side</div>
              <div className="postcardBackBody">{letter.message}</div>
            </div>
          </>
        ) : (
          <div className="soft" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {letter.message}
          </div>
        )}

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

export default async function LetterOpenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await params).token;
  const token = raw.replace(/^\/+/, "").replace(/^l\//, "");
  const sp = (await searchParams) ?? {};
  const auto = Array.isArray(sp.auto) ? sp.auto[0] : sp.auto;
  const celebrate = Array.isArray(sp.celebrate) ? sp.celebrate[0] : sp.celebrate;
  const supabase = await createSupabaseServerReadClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const { data: statusData } = await supabase.rpc("status_letter_by_token", { p_token: token });
  const status = (Array.isArray(statusData) ? statusData[0] : statusData) as StatusRow | null | undefined;
  let deliveryType: "letter" | "postcard" = "letter";
  let postcardTemplateId: string | null = null;
  const { data: metaRow, error: metaErr } = await supabase
    .from("letters")
    .select("delivery_type, postcard_template_id")
    .eq("public_token", token)
    .maybeSingle();
  if (!metaErr && metaRow) {
    deliveryType = metaRow.delivery_type === "postcard" ? "postcard" : "letter";
    postcardTemplateId = metaRow.postcard_template_id ?? null;
    if (deliveryType !== "postcard" && postcardTemplateId) {
      deliveryType = "postcard";
    }
  } else if (status?.delivery_type === "postcard") {
    deliveryType = "postcard";
    postcardTemplateId = status?.postcard_template_id ?? null;
  }
  let isPostcard = deliveryType === "postcard";
  const postcardTemplate =
    POSTCARD_TEMPLATES.find((p) => p.id === postcardTemplateId) ?? POSTCARD_TEMPLATES[0] ?? null;
  if (!isPostcard && status?.seal_id == null && status?.subject) {
    isPostcard = true;
  }

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
                <h1 className="h1">{isPostcard ? "Open postcard" : "Open letter"}</h1>
              </div>
              <StatusCard status={status} />
              {isPostcard ? (
                <div className={`card ${styles.statusLetterCard}`} style={{ marginTop: 16 }}>
                  <div className="cardHead" style={{ textAlign: "center", justifyContent: "center" }}>
                    <div>
                      <div className="kicker">Postcard</div>
                      <div className="h2">{status?.from_name ? `From ${status.from_name}` : "From someone"}</div>
                      {status?.subject ? <div className="muted">{status.subject}</div> : null}
                    </div>
                  </div>
                  <div className="postcardPreview" style={postcardTemplate?.preview}>
                    <div className="postcardPreviewLabel">{postcardTemplate?.name ?? "Postcard"}</div>
                    <div className="postcardBackHint">Back side: message + address</div>
                  </div>
                </div>
              ) : (
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
              )}
              <div style={{ marginTop: 16 }}>
                <OtpForm />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (auto === "1") {
    const supabaseAction = await createSupabaseServerActionClient();
    const { error: openErr } = await supabaseAction.rpc("open_letter_by_public_token", { p_token: token });
    if (!openErr) {
      redirect(`/l/${token}/open?celebrate=1`);
    }
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
            <h1 className="h1">{isOpened ? (isPostcard ? "Postcard read" : "Seal broken") : isPostcard ? "Open postcard" : "Open letter"}</h1>
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
                {isPostcard ? "This postcard is now yours to keep." : "The seal is broken. This letter is now yours to keep."}
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
            <div style={{ position: "relative", overflow: "hidden" }}>
              <ConfettiBurst active={celebrate === "1"} />
              <ReceiptCard
                bird_type={openedRow!.bird_type}
                dest_region_id={openedRow!.dest_region_id}
                eta_at={openedRow!.eta_at}
                opened_at={openedRow!.opened_at}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <LetterView
                letter={openedRow as LetterRow}
                title={status?.subject ? status.subject : "(No subject)"}
                isPostcard={isPostcard}
                postcardTemplate={postcardTemplate}
              />
            </div>
          </>
        ) : (
          <>
            {isPostcard ? (
              <div className={`card ${styles.statusLetterCard}`} style={{ marginTop: 16 }}>
                <div className="cardHead" style={{ textAlign: "center", justifyContent: "center" }}>
                  <div>
                    <div className="kicker">Postcard</div>
                    <div className="h2">{status?.from_name ? `From ${status.from_name}` : "From someone"}</div>
                    {status?.subject ? <div className="muted">{status.subject}</div> : null}
                  </div>
                </div>
                <UnsealButton
                  token={token}
                  variant="seal"
                  className="postcardPreview"
                  itemLabel="postcard"
                  buttonProps={{
                    "aria-label": "Read postcard",
                    title: "Read postcard",
                    style: postcardTemplate?.preview,
                  }}
                >
                  <div className="postcardPreviewLabel">{postcardTemplate?.name ?? "Postcard"}</div>
                  <div className="postcardBackHint">Tap to read the back.</div>
                </UnsealButton>
              </div>
            ) : (
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
            )}

          </>
        )}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <a href="/dashboard?tab=incoming" className="link">
            Back to inbox
          </a>
        </div>
        </div>
        </div>
      </main>
    </>
  );
}
