import OtpForm from "./_components/OtpForm";
import UnsealButton from "./_components/UnsealButton";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import { US_REGIONS } from "@/app/lib/geo/usRegions";
import CleanAuthHash from "./_components/CleanAuthHash";

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

type PreviewRow = {
  bird_type: string;
  dest_region_id: string;
  eta_at: string;
};

type StatusRow = {
  bird_type: string | null;
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

function StatusCard({ status, title }: { status: StatusRow; title?: string }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Flight status</div>
          <div className="h2">{title ?? "In transit"}</div>
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

function ReceiptCard({ bird_type, dest_region_id, eta_at }: PreviewRow) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Delivery receipt</div>
          <div className="h2">Arrived safely</div>
          <div className="muted" style={{ marginTop: 6, maxWidth: 560 }}>
            The seal is broken. This letter is now yours to keep.
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            Bird
          </div>
          <div style={{ fontWeight: 700 }}>{bird_type}</div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            Destination
          </div>
          <div style={{ fontWeight: 700 }}>{regionLabelFor(dest_region_id)}</div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            ETA
          </div>
          <div style={{ fontWeight: 700 }}>{formatLocal(eta_at)}</div>
        </div>
      </div>
    </div>
  );
}

function LetterView({ letter }: { letter: LetterRow }) {
  return (
    <div className="card" style={{ maxWidth: 740 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Opened letter</div>
          <div className="h2">Delivered to you</div>
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

function InvalidLinkCard({ openedMessage }: { openedMessage?: boolean }) {
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="err">
        ❌ This link is {openedMessage ? "invalid, expired, or already used" : "invalid or expired"}.
      </div>
    </div>
  );
}

export default async function LetterTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerReadClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const { data: statusData } = await supabase.rpc("status_letter_by_token", { p_token: token });
  const status = (Array.isArray(statusData) ? statusData[0] : statusData) as StatusRow | null | undefined;

  const etaMs = status?.eta_at ? new Date(status.eta_at).getTime() : null;
  const arrived = !!(etaMs && Date.now() >= etaMs);

  // Logged out: preview + OTP
  if (!user) {
    return (
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <h1 className="h1">Flight status</h1>
          <p className="muted" style={{ maxWidth: 720 }}>
            Sign in to open the letter. The message stays sealed until it arrives.
          </p>

          {!status ? <InvalidLinkCard /> : <StatusCard status={status} />}

          <div style={{ marginTop: 16 }}>
            <OtpForm />
          </div>
        </div>
      </main>
    );
  }

  // Logged in: prefer opened, else show preview
  const { data: openedData } = await supabase.rpc("read_opened_letter_by_token", { p_token: token });
  const openedRow = (Array.isArray(openedData) ? openedData[0] : openedData) as LetterRow | null | undefined;
  const isOpened = !!openedRow?.id;

  if (isOpened) {
    return (
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <h1 className="h1">Letter Delivered</h1>

          <ReceiptCard
            bird_type={openedRow!.bird_type}
            dest_region_id={openedRow!.dest_region_id}
            eta_at={openedRow!.eta_at}
          />

          <div style={{ marginTop: 16 }}>
            <LetterView letter={openedRow as LetterRow} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pageBg">
      <CleanAuthHash />
      <div className="wrap">
        <h1 className="h1">Flight status</h1>

        {!status ? (
          <InvalidLinkCard openedMessage />
        ) : (
          <>
            <StatusCard status={status} title="In transit" />
            <div style={{ marginTop: 16 }}>
              {arrived ? (
                <UnsealButton token={token} />
              ) : (
                <div className="muted">
                  Arrives at {status.eta_at ? formatLocal(status.eta_at) : "an unknown time"}. You
                  can unseal when it lands.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
