export default function AboutPage() {
  return (
    <main className="pageBg">
      <div className="wrap">
        {/* 🕊️ Image card */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "26px 16px 22px",
              textAlign: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/birds/homing-pigeon-landed.png"
              alt="Homing pigeon at rest"
              className="aboutPigeon"
              style={{
                width: 150,
                height: "auto",
                opacity: 0.96,
                filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.10))",
                transformOrigin: "50% 60%",
              }}
            />

            <div
              className="aboutSubtitle"
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

          {/* local, page-only styles */}
          <style>{`
            @keyframes flokFloatBreath {
              0%   { transform: translateY(0px)    scale(1);    opacity: 0.96; }
              50%  { transform: translateY(-6px)   scale(1.015);opacity: 1; }
              100% { transform: translateY(0px)    scale(1);    opacity: 0.96; }
            }

            .aboutPigeon {
              animation: flokFloatBreath 4.8s ease-in-out infinite;
              will-change: transform, opacity;
            }

            /* Respect reduced motion */
            @media (prefers-reduced-motion: reduce) {
              .aboutPigeon {
                animation: none !important;
              }
            }
          `}</style>
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