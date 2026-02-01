"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  postcardTemplate: { name: string; preview: CSSProperties; back: CSSProperties } | null;
  message: string | null | undefined;
  backTitle?: string;
  defaultSide?: "front" | "back";
};

export default function PostcardFlip({
  postcardTemplate,
  message,
  backTitle,
  defaultSide = "front",
}: Props) {
  const [side, setSide] = useState<"front" | "back">(defaultSide);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btnGhost"
          onClick={() => setSide((prev) => (prev === "front" ? "back" : "front"))}
          aria-pressed={side === "back"}
        >
          {side === "front" ? "Flip to back" : "Flip to front"}
        </button>
      </div>

      {side === "front" ? (
        <div className="postcardPreview fullWidth" style={{ maxHeight: "none" }}>
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
          <div className="postcardBackHint">Front</div>
        </div>
      ) : (
        <div className="postcardPreview fullWidth" style={{ maxHeight: "none" }}>
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
        </div>
      )}
    </div>
  );
}
