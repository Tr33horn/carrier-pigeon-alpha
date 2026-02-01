"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  postcardTemplate: { name: string; preview: CSSProperties; back: CSSProperties } | null;
  message: string | null | undefined;
  backTitle?: string;
  defaultSide?: "front" | "back";
  fromName?: string | null;
  toName?: string | null;
};

export default function PostcardFlip({
  postcardTemplate,
  message,
  backTitle,
  defaultSide = "front",
  fromName,
  toName,
}: Props) {
  const [side, setSide] = useState<"front" | "back">(defaultSide === "back" ? "back" : "front");

  return (
    <div className="stack" style={{ gap: 12 }}>
      {side === "front" ? (
        <div className="postcardPreview fullWidth" style={{ maxHeight: "none" }}>
          <button
            type="button"
            className="btnGhost postcardFlipToggle"
            onClick={() => setSide((prev) => (prev === "front" ? "back" : "front"))}
            aria-pressed={side === "back"}
          >
            Flip to back
          </button>
          <div
            className="postcardPreviewArt contain"
            style={
              postcardTemplate
                ? {
                    ...postcardTemplate.preview,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: "#f3efe6",
                  }
                : undefined
            }
          />
          {null}
        </div>
      ) : (
        <div className="postcardPreview fullWidth" style={{ maxHeight: "none" }}>
          <button
            type="button"
            className="btnGhost postcardFlipToggle"
            onClick={() => setSide((prev) => (prev === "front" ? "back" : "front"))}
            aria-pressed={side === "back"}
          >
            Flip to front
          </button>
          <div
            className="postcardPreviewArt contain"
            style={
              postcardTemplate
                ? {
                    ...postcardTemplate.back,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: "#f3efe6",
                  }
                : undefined
            }
          />
          <div className="postcardBackOverlay">
            {backTitle ? <div className="postcardBackTitle">{backTitle}</div> : null}
            <div className="postcardBackBody">{message}</div>
          </div>
          <div className="postcardBackMeta">
            <div>
              <div className="postcardBackMetaLabel">From:</div>
              <div className="postcardBackMetaValue">{fromName || "Someone"}</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="postcardBackMetaLabel">To:</div>
              <div className="postcardBackMetaValue">{toName || "Someone"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
