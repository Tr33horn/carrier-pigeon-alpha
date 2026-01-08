export default function AboutPage() {
  return (
    <main className="pageBg">
      <div className="wrap">
        {/* 🕊️ Image card */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "28px 16px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/birds/homing-pigeon-landed.png"
              alt="Homing pigeon at rest"
              style={{
                width: 140,
                height: "auto",
                opacity: 0.95,
              }}
            />
          </div>
        </div>

        {/* ✉️ About text */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="kicker">About</div>
              <h1 className="h1">What is FLOK?</h1>
            </div>
          </div>

          <div className="soft">
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
        </div>
      </div>
    </main>
  );
}