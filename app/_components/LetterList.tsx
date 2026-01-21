import { US_REGIONS } from "@/app/lib/geo/usRegions";

type LetterListItem = {
  id: string;
  bird_type?: string | null;
  bird?: string | null;
  dest_region_id?: string | null;
  dest_name?: string | null;
  created_at?: string | null;
  opened_at?: string | null;
};

const REGION_LABELS = new Map<string, string>(US_REGIONS.map((r) => [r.id, r.label]));

function regionLabelFor(destRegionId?: string | null, destName?: string | null) {
  if (destRegionId && REGION_LABELS.has(destRegionId)) return REGION_LABELS.get(destRegionId) as string;
  if (destName) return destName;
  if (destRegionId) return destRegionId;
  return "somewhere over the map";
}

function formatLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

export default function LetterList({
  title,
  letters,
}: {
  title: string;
  letters: LetterListItem[];
}) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="kicker">Letters</div>
          <div className="h2">{title}</div>
        </div>
      </div>

      {letters.length === 0 ? (
        <div className="muted">No letters yet.</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {letters.map((letter) => {
            const bird = letter.bird_type || letter.bird || "Unknown bird";
            const destination = regionLabelFor(letter.dest_region_id, letter.dest_name);
            const opened = !!letter.opened_at;
            const timeLabel = opened ? formatLocal(letter.opened_at) : formatLocal(letter.created_at);

            return (
              <div key={letter.id} className="soft" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontWeight: 800 }}>{destination}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {bird} • {opened ? "Opened" : "Sealed"}
                    {timeLabel ? ` • ${timeLabel}` : ""}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {letter.id}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
