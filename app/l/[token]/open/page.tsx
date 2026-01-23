import { redirect } from "next/navigation";

import OtpForm from "../_components/OtpForm";
import UnsealButton from "../_components/UnsealButton";
import CleanAuthHash from "../_components/CleanAuthHash";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import { US_REGIONS } from "@/app/lib/geo/usRegions";

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

function ReceiptCard({ bird_type, dest_region_id, eta_at }: StatusRow) {
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
          <div style={{ fontWeight: 700 }}>{bird_type ?? "bird"}</div>
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
          <div style={{ fontWeight: 700 }}>{eta_at ? formatLocal(eta_at) : "ETA unknown"}</div>
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
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <h1 className="h1">Open letter</h1>
          <InvalidLinkCard />
        </div>
      </main>
    );
  }

  const etaMs = status.eta_at ? new Date(status.eta_at).getTime() : null;
  const arrived = !!(etaMs && Date.now() >= etaMs);

  if (!arrived) {
    redirect(`/l/${token}`);
  }

  if (!user) {
    return (
      <main className="pageBg">
        <CleanAuthHash />
        <div className="wrap">
          <h1 className="h1">Open letter</h1>
          <StatusCard status={status} />
          <div style={{ marginTop: 16 }}>
            <OtpForm />
          </div>
        </div>
      </main>
    );
  }

  const { data: openedData } = await supabase.rpc("read_opened_letter_by_token", { p_token: token });
  const openedRow = (Array.isArray(openedData) ? openedData[0] : openedData) as LetterRow | null | undefined;
  const isOpened = !!openedRow?.id;

  return (
    <main className="pageBg">
      <CleanAuthHash />
      <div className="wrap">
        <h1 className="h1">Open letter</h1>

        <div style={{ marginTop: 8 }}>
          <a className="link" href={`/l/${token}`}>
            View flight status
          </a>
        </div>

        {isOpened ? (
          <>
            <ReceiptCard
              bird_type={openedRow!.bird_type}
              dest_region_id={openedRow!.dest_region_id}
              eta_at={openedRow!.eta_at}
              sent_at={null}
              opened_at={openedRow!.opened_at}
              canceled_at={null}
            />
            <div style={{ marginTop: 16 }}>
              <LetterView letter={openedRow as LetterRow} />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16 }}>
            <UnsealButton token={token} />
          </div>
        )}
      </div>
    </main>
  );
}
