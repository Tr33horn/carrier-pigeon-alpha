import AppHeader from "@/app/_components/AppHeader";

export default function AboutPage() {
  return (
    <>
      <AppHeader />
      <main className="pageBg">
        <div className="wrap">
          <div className="card">
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              padding: "28px 16px 0",
            }}
          >
            <div className="kicker">About</div>
            <h1 className="h1" style={{ marginBottom: 18 }}>
              What is FLOK?
            </h1>
          </div>

          {/* Pigeon image */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "8px 16px 10px",
              textAlign: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/birds/homing-pigeon-landed.png"
              alt="Homing pigeon at rest"
              style={{
                width: 150,
                height: "auto",
                opacity: 0.96,
                // no background, no wrapper — let the transparency breathe
              }}
            />

            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                lineHeight: "18px",
                opacity: 0.78,
                letterSpacing: "0.01em",
              }}
            >
              A small wingbeat now… a little wonder later.
            </div>
          </div>

          {/* About text */}
          <div
            className="soft"
            style={{
              textAlign: "center",
              maxWidth: 560,
              margin: "0 auto",
              paddingBottom: 22,
            }}
          >
            <p>
              FLOK is a slow-message experiment inspired by carrier pigeons,
              handwritten letters, and the lost joy of waiting.
            </p>

            <p style={{ marginTop: 12 }}>
              Instead of instant delivery, letters travel in real time across
              the map, sleep overnight, earn badges, and arrive when they
              arrive.
            </p>

            <p style={{ marginTop: 12 }}>
              It’s intentionally whimsical, slightly impractical, and meant to
              feel more like anticipation than efficiency.
            </p>

            <p style={{ marginTop: 12 }} className="muted">
              No ads. No feeds. Just messages in flight.
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              padding: "10px 16px 22px",
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            <div style={{ marginBottom: 6 }}>Made with care.</div>

            <a
              href="/"
              style={{
                textDecoration: "none",
                fontSize: 13,
                opacity: 0.85,
                borderBottom: "1px dashed rgba(0,0,0,0.25)",
                paddingBottom: 1,
              }}
            >
              ← back home
            </a>
          </div>
        </div>
        </div>
      </main>
    </>
  );
}
